'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import type { Product, CategoryType } from '../../data/products';
import { PRODUCTS, CATEGORIES, FACETS_CONFIG, formatINR, calculateSaving } from '../../data/products';
import { POLICIES, INTEGRATION_INFOS } from '../../data/policies';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { DeviceArt } from '../../components/DeviceArt';

const CART_STORAGE_KEY = 'novatech-demo-cart';
const RECENT_SEARCHES_KEY = 'novatech-search-recent-v1';
const PRICE_LIMIT = 150000;
const PAGE_SIZE = 6;

function SearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Search and Filter State
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(PRICE_LIMIT);
  const [sort, setSort] = useState<'featured' | 'low' | 'high'>('featured');
  const [selectedFacets, setSelectedFacets] = useState<Record<string, string[]>>({
    category: [],
    brand: [],
    cpu: [],
    ram: [],
    storage: [],
    screen: [],
  });

  const [page, setPage] = useState(1);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  // Dialog State
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [panelTitle, setPanelTitle] = useState('');
  const [panelBody, setPanelBody] = useState<React.ReactNode>(null);

  // Personalized Recommendations State
  const [recommendations, setRecommendations] = useState<
    { product: Product; reason: string }[]
  >([]);

  // 1. Initialise State from URL Search Params
  useEffect(() => {
    const q = searchParams.get('q') || '';
    setQuery(q);

    const min = Number(searchParams.get('min'));
    if (Number.isFinite(min) && min >= 0) setMinPrice(min);

    const max = Number(searchParams.get('max'));
    if (Number.isFinite(max) && max > 0) setMaxPrice(max);

    const s = searchParams.get('sort');
    if (s === 'low' || s === 'high' || s === 'featured') setSort(s);

    const initialFacets: Record<string, string[]> = {
      category: searchParams.getAll('category'),
      brand: searchParams.getAll('brand'),
      cpu: searchParams.getAll('cpu'),
      ram: searchParams.getAll('ram'),
      storage: searchParams.getAll('storage'),
      screen: searchParams.getAll('screen'),
    };
    setSelectedFacets(initialFacets);
  }, [searchParams]);

  // 2. Load Cart and Recent Searches from localStorage & sync across tabs
  useEffect(() => {
    const syncCart = () => {
      try {
        const savedCart = localStorage.getItem(CART_STORAGE_KEY);
        if (savedCart) {
          setCart(JSON.parse(savedCart));
        }
      } catch {}
    };

    syncCart();
    try {
      const savedRecent = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (savedRecent) {
        setRecentSearches(JSON.parse(savedRecent));
      }
    } catch {}

    window.addEventListener('storage', syncCart);
    window.addEventListener('novatech:cart-updated', syncCart);
    return () => {
      window.removeEventListener('storage', syncCart);
      window.removeEventListener('novatech:cart-updated', syncCart);
    };
  }, []);

  // 3. Fetch Personalized Recommendations based on context
  useEffect(() => {
    async function loadRecommendations() {
      try {
        const res = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recentSearches,
            cartItems: Object.keys(cart),
            limit: 3,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.recommendations) {
            setRecommendations(data.recommendations);
          }
        }
      } catch {}
    }
    loadRecommendations();
  }, [recentSearches, cart]);

  // Save Recent Search
  const commitRecentSearch = useCallback(
    (term: string) => {
      const trimmed = term.trim();
      if (!trimmed) return;
      const updated = [
        trimmed,
        ...recentSearches.filter((s) => s.toLowerCase() !== trimmed.toLowerCase()),
      ].slice(0, 8);
      setRecentSearches(updated);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {}
    },
    [recentSearches]
  );

  // Cart operations
  const addToCart = useCallback((productId: string) => {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return;
    setCart((prev) => {
      const updated = { ...prev, [productId]: (prev[productId] || 0) + 1 };
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('novatech:cart-updated'));
      } catch {}
      return updated;
    });
    setAnnouncement(`${product.name} added to demo bag.`);
  }, []);

  const updateQuantity = useCallback((productId: string, step: number) => {
    setCart((prev) => {
      const updated = { ...prev };
      const next = (updated[productId] || 0) + step;
      if (next <= 0) {
        delete updated[productId];
      } else {
        updated[productId] = next;
      }
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('novatech:cart-updated'));
      } catch {}
      return updated;
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => {
      const updated = { ...prev };
      delete updated[productId];
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('novatech:cart-updated'));
      } catch {}
      return updated;
    });
  }, []);

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  // Dialog Controls
  const openPanel = useCallback((title: string, content: React.ReactNode) => {
    setPanelTitle(title);
    setPanelBody(content);
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, []);

  const closePanel = useCallback(() => {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, []);

  const showCart = useCallback(() => {
    const entries = Object.entries(cart);
    const subtotal = entries.reduce((sum, [id, q]) => {
      const p = PRODUCTS.find((item) => item.id === id);
      return sum + (p ? p.price * q : 0);
    }, 0);

    const content =
      entries.length > 0 ? (
        <div>
          <div className="cart-lines-list">
            {entries.map(([id, q]) => {
              const p = PRODUCTS.find((item) => item.id === id);
              if (!p) return null;
              return (
                <div key={id} className="cart-line">
                  <div className="cart-line-info">
                    <strong>{p.name}</strong>
                    <div className="cart-item-price">{formatINR(p.price * q)}</div>
                  </div>
                  <div className="controls">
                    <button
                      type="button"
                      data-quantity={id}
                      data-step="-1"
                      onClick={() => updateQuantity(id, -1)}
                    >
                      −
                    </button>
                    <span className="cart-qty-num">{q}</span>
                    <button
                      type="button"
                      data-quantity={id}
                      data-step="1"
                      onClick={() => updateQuantity(id, 1)}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      data-remove={id}
                      className="cart-remove-btn"
                      onClick={() => removeItem(id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="cart-total">
            <span>Estimated subtotal</span>
            <span>{formatINR(subtotal)}</span>
          </div>
          <p className="notice">
            Demo bag saved in this browser. Stock is unverified. Final tax, shipping, and total require the checkout service.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => {
              const info = INTEGRATION_INFOS.checkout;
              openPanel(
                info.title,
                <div>
                  <p style={{ marginBottom: 16 }}>{info.body}</p>
                  <button type="button" className="btn btn-primary" onClick={closePanel}>
                    Keep exploring
                  </button>
                </div>
              );
            }}
          >
            Continue to checkout ↗
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '30px 10px' }}>
          <p style={{ fontSize: 16, marginBottom: 20 }}>Your bag is currently empty.</p>
          <button type="button" className="btn btn-primary" onClick={closePanel}>
            Continue exploring
          </button>
        </div>
      );

    openPanel('Your bag', content);
  }, [cart, updateQuantity, removeItem, openPanel, closePanel]);

  const handleQuickView = useCallback(
    (productId: string) => {
      const p = PRODUCTS.find((item) => item.id === productId);
      if (!p) return;
      const saving = calculateSaving(p.mrp, p.price);

      openPanel(
        p.name,
        <div className="quickview-shell">
          <div className="product-art quickview-art">
            <DeviceArt product={p} variant="quickview" />
          </div>
          <p className="quickview-specs">{p.cpu ? `${p.cpu} · ` : ''}{p.specs}</p>
          <div className="product-price quickview-price">
            <span className="current-price-val">{formatINR(p.price)}</span>
            {p.mrp && <del className="mrp-val">{formatINR(p.mrp)}</del>}
            {saving && (
              <span className="hero-saving-pill" style={{ marginLeft: 10 }}>
                Save {formatINR(saving)}
              </span>
            )}
          </div>
          <p className="notice">
            Sample catalogue. Stock availability is unknown until the live service is connected.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              addToCart(p.id);
              closePanel();
            }}
          >
            Add to demo bag +
          </button>
        </div>
      );
    },
    [openPanel, closePanel, addToCart]
  );

  const handlePolicy = useCallback(
    (key: string) => {
      const policy = POLICIES[key];
      if (!policy) return;
      openPanel(
        'Ask NovaTech',
        <div>
          <p className="policy-answer-text">{policy.content}</p>
          <p className="policy-meta-badge">
            <strong>Confidence: {policy.confidence}</strong> · Follow-up: {policy.followUpRequired ? 'Yes' : 'No'}
          </p>
          <details className="policy-source-details" open>
            <summary>
              Source: {policy.documentTitle} · {policy.version}
            </summary>
            <p className="policy-source-section">Section: {policy.section}</p>
            <blockquote className="policy-quote">{policy.content}</blockquote>
          </details>
        </div>
      );
    },
    [openPanel]
  );

  const handleInfo = useCallback(
    (key: 'account' | 'orders' | 'checkout' | 'support') => {
      const info = INTEGRATION_INFOS[key];
      if (!info) return;
      openPanel(
        info.title,
        <div>
          <p style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 20 }}>{info.body}</p>
          <button type="button" className="btn btn-primary" onClick={closePanel}>
            Keep exploring
          </button>
        </div>
      );
    },
    [openPanel, closePanel]
  );

  // Facet toggling
  const toggleFacet = (facetKey: string, value: string) => {
    setSelectedFacets((prev) => {
      const current = prev[facetKey] || [];
      const updated = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [facetKey]: updated };
    });
    setPage(1);
  };

  const clearAllFilters = () => {
    setQuery('');
    setMinPrice(0);
    setMaxPrice(PRICE_LIMIT);
    setSort('featured');
    setSelectedFacets({
      category: [],
      brand: [],
      cpu: [],
      ram: [],
      storage: [],
      screen: [],
    });
    setPage(1);
  };

  // Compare Toggle
  const toggleCompare = (id: string) => {
    setCompareIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 3) {
        alert('You can compare a maximum of 3 products at a time.');
        return prev;
      }
      return [...prev, id];
    });
  };

  // Show Comparison Modal
  const openComparisonModal = () => {
    const selectedProducts = compareIds
      .map((id) => PRODUCTS.find((p) => p.id === id))
      .filter(Boolean) as Product[];

    openPanel(
      'A closer look, side by side',
      <div className="compare-scroll">
        <table className="compare-table">
          <thead>
            <tr>
              <th scope="col">Specification</th>
              {selectedProducts.map((p) => (
                <th key={p.id} scope="col">
                  {p.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Price</th>
              {selectedProducts.map((p) => (
                <td key={p.id}>{formatINR(p.price)}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Processor</th>
              {selectedProducts.map((p) => (
                <td key={p.id}>{p.cpu || '—'}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">RAM</th>
              {selectedProducts.map((p) => (
                <td key={p.id}>{p.ram ? `${p.ram} GB` : '—'}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Storage</th>
              {selectedProducts.map((p) => (
                <td key={p.id}>{p.storage || '—'}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Display</th>
              {selectedProducts.map((p) => (
                <td key={p.id}>{p.screen || '—'}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Specifications</th>
              {selectedProducts.map((p) => (
                <td key={p.id}>{p.specs}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">Action</th>
              {selectedProducts.map((p) => (
                <td key={p.id}>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ minHeight: 36, padding: '6px 12px', fontSize: 12 }}
                    onClick={() => {
                      addToCart(p.id);
                      closePanel();
                    }}
                  >
                    Add to bag
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <p className="filter-hint" style={{ marginTop: 14 }}>
          Only official catalogue specifications are compared.
        </p>
      </div>
    );
  };

  // Filter Matching Logic
  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return PRODUCTS.filter((p) => {
      // Price range
      if (p.price < minPrice || p.price > maxPrice) return false;

      // Text query
      if (q) {
        const textBlob = `${p.name} ${p.category} ${p.brand} ${p.cpu} ${p.ram}GB ${p.specs} ${p.storage || ''} ${p.screen || ''}`.toLowerCase();
        const tokens = q.split(' ').filter(Boolean);
        if (!tokens.every((t) => textBlob.includes(t))) return false;
      }

      // Checkbox facets
      for (const [key, values] of Object.entries(selectedFacets)) {
        if (values.length > 0) {
          const productValue = String((p as any)[key] || '');
          if (!values.includes(productValue)) return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sort === 'low') return a.price - b.price;
      if (sort === 'high') return b.price - a.price;
      return 0;
    });
  }, [query, minPrice, maxPrice, selectedFacets, sort]);

  // Facet count calculator
  const getFacetCount = (key: string, value: string) => {
    return PRODUCTS.filter((p) => {
      if (p.price < minPrice || p.price > maxPrice) return false;
      if (query) {
        const textBlob = `${p.name} ${p.category} ${p.brand} ${p.cpu} ${p.ram}GB ${p.specs}`.toLowerCase();
        if (!textBlob.includes(query.toLowerCase())) return false;
      }
      return String((p as any)[key] || '') === value;
    }).length;
  };

  // Active filter chips list
  const activeChips = useMemo(() => {
    const chips: { label: string; onRemove: () => void }[] = [];
    if (query) {
      chips.push({
        label: `Search: "${query}"`,
        onRemove: () => setQuery(''),
      });
    }
    if (minPrice > 0 || maxPrice < PRICE_LIMIT) {
      chips.push({
        label: `${formatINR(minPrice)} – ${formatINR(maxPrice)}`,
        onRemove: () => {
          setMinPrice(0);
          setMaxPrice(PRICE_LIMIT);
        },
      });
    }
    for (const [key, values] of Object.entries(selectedFacets)) {
      for (const val of values) {
        chips.push({
          label: val,
          onRemove: () => toggleFacet(key, val),
        });
      }
    }
    return chips;
  }, [query, minPrice, maxPrice, selectedFacets]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginated = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Quick Amazon-Style Narrow Pills
  const quickNarrowFilters = [
    { label: 'Under ₹70,000', apply: () => setMaxPrice(70000) },
    { label: 'Gaming', apply: () => toggleFacet('category', 'Gaming') },
    { label: 'Core Ultra 5', apply: () => toggleFacet('cpu', 'Core Ultra 5') },
    { label: '16 GB RAM', apply: () => toggleFacet('ram', '16') },
    { label: '512 GB SSD', apply: () => toggleFacet('storage', '512 GB SSD') },
    { label: '14-inch', apply: () => toggleFacet('screen', '14-inch') },
  ];

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* Global Header */}
      <Header
        searchQuery={query}
        onSearchChange={(q) => {
          setQuery(q);
          setPage(1);
        }}
        cartCount={cartCount}
        onOpenCart={showCart}
        onOpenInfo={handleInfo}
        onOpenPolicy={handlePolicy}
        selectedCategory={(selectedFacets.category?.[0] as CategoryType) || 'All'}
        onSelectCategory={(cat) => {
          if (cat === 'All') {
            setSelectedFacets((prev) => ({ ...prev, category: [] }));
          } else {
            setSelectedFacets((prev) => ({ ...prev, category: [cat] }));
          }
          setPage(1);
        }}
      />

      <main id="main">
        <section className="section catalogue wrap" aria-labelledby="catalogue-title">
          {/* Breadcrumb Navigation */}
          <div className="discovery-kicker">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>Search Results &amp; Filters</span>
          </div>

          <div className="section-head" style={{ marginBottom: 20 }}>
            <div>
              <p className="eyebrow-tag">Consider your possibilities</p>
              <h1 id="catalogue-title" className="search-page-title">
                The right tech. On your terms.
              </h1>
            </div>
            <span className="badge badge-subtle">
              Amazon-Style Dedicated Discovery
            </span>
          </div>

          {/* Quick "Narrow Your Search" Bar */}
          <div className="narrow-search-container">
            <div className="narrow-title">Narrow your search</div>
            <div className="narrow-pills-scroll">
              {quickNarrowFilters.map((pill) => (
                <button
                  key={pill.label}
                  type="button"
                  className="narrow-pill"
                  onClick={pill.apply}
                >
                  <span>{pill.label}</span>
                  <span aria-hidden="true">+</span>
                </button>
              ))}
            </div>
          </div>

          {/* Two-Column Search Layout */}
          <div className="catalogue-layout">
            {/* Left Filter Sidebar */}
            <aside
              className={`filter-panel ${mobileFiltersOpen ? 'is-open' : ''}`}
              aria-labelledby="filters-heading"
            >
              <div className="filter-heading">
                <h3 id="filters-heading">Refine your search</h3>
                <button
                  type="button"
                  className="plain mobile-filter-close"
                  onClick={() => setMobileFiltersOpen(false)}
                  aria-label="Close filters"
                >
                  ×
                </button>
              </div>

              <div className="filter-heading">
                <span className="filter-hint">Make it a perfect fit.</span>
                <button
                  type="button"
                  className="text-button"
                  onClick={clearAllFilters}
                >
                  Clear all
                </button>
              </div>

              {/* Price Range Accordion */}
              <details className="facet" open>
                <summary>Price range</summary>
                <div className="price-band" aria-hidden="true">
                  <span style={{ height: 10 }} />
                  <span style={{ height: 18 }} />
                  <span style={{ height: 28 }} />
                  <span style={{ height: 32 }} />
                  <span style={{ height: 22 }} />
                  <span style={{ height: 14 }} />
                  <span style={{ height: 8 }} />
                  <span style={{ height: 12 }} />
                </div>
                <div className="range-values">
                  <label>
                    Min (₹)
                    <input
                      type="number"
                      min={0}
                      max={PRICE_LIMIT}
                      value={minPrice}
                      onChange={(e) => setMinPrice(Number(e.target.value))}
                    />
                  </label>
                  <label>
                    Max (₹)
                    <input
                      type="number"
                      min={0}
                      max={PRICE_LIMIT}
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(Number(e.target.value))}
                    />
                  </label>
                </div>
                <label className="range-control">
                  Min slider
                  <input
                    type="range"
                    min={0}
                    max={PRICE_LIMIT}
                    step={1000}
                    value={minPrice}
                    onChange={(e) => setMinPrice(Number(e.target.value))}
                  />
                </label>
                <label className="range-control">
                  Max slider
                  <input
                    type="range"
                    min={0}
                    max={PRICE_LIMIT}
                    step={1000}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                  />
                </label>
              </details>

              {/* Dynamic Facets Accordions */}
              {Object.entries(FACETS_CONFIG).map(([key, config]) => (
                <details key={key} className="facet" open>
                  <summary>{config.title}</summary>
                  <div className="facet-options">
                    {config.values.map((val) => {
                      const isSelected = (selectedFacets[key] || []).includes(val);
                      const count = getFacetCount(key, val);
                      return (
                        <label
                          key={val}
                          className={`facet-option ${count === 0 && !isSelected ? 'is-disabled' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={count === 0 && !isSelected}
                            onChange={() => toggleFacet(key, val)}
                          />
                          <span>
                            {(config as any).label ? (config as any).label(val) : val}
                          </span>
                          <span className="facet-count">{count}</span>
                        </label>
                      );
                    })}
                  </div>
                </details>
              ))}

              {/* Pending Availability & Reviews Accordion */}
              <details className="facet">
                <summary>Availability &amp; reviews</summary>
                <div className="facet-options">
                  <label className="facet-option is-disabled">
                    <input type="checkbox" disabled />
                    <span>In stock</span>
                    <span className="facet-count">Not connected</span>
                  </label>
                  <label className="facet-option is-disabled">
                    <input type="checkbox" disabled />
                    <span>4 stars &amp; above</span>
                    <span className="facet-count">Sample data</span>
                  </label>
                </div>
              </details>

              <button
                type="button"
                className="btn btn-primary filter-apply"
                onClick={() => setMobileFiltersOpen(false)}
              >
                Show {filteredProducts.length} products
              </button>
            </aside>

            {/* Right Main Discovery Results Area */}
            <div className="discovery-main">
              {/* Autocomplete Catalogue Search */}
              <form
                className="catalogue-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  commitRecentSearch(query);
                  setShowSuggestions(false);
                }}
              >
                <input
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  placeholder="Try NovaBook Air, Ryzen 5, 16 GB RAM or 512 GB SSD…"
                />
                <button type="submit" className="search-submit">
                  Search ↗
                </button>

                {/* Suggestions Dropdown */}
                {showSuggestions && (
                  <div className="suggestions">
                    <div className="suggestion-label">
                      {query ? 'Suggested Matches' : 'Recent Searches & Popular'}
                    </div>
                    {recentSearches.map((term) => (
                      <div
                        key={term}
                        className="suggestion"
                        onClick={() => {
                          setQuery(term);
                          setShowSuggestions(false);
                        }}
                      >
                        <span>🕒 {term}</span>
                        <small>Recent</small>
                      </div>
                    ))}
                    {PRODUCTS.filter(
                      (p) =>
                        !query ||
                        p.name.toLowerCase().includes(query.toLowerCase())
                    )
                      .slice(0, 4)
                      .map((p) => (
                        <div
                          key={p.id}
                          className="suggestion"
                          onClick={() => {
                            setQuery(p.name);
                            setShowSuggestions(false);
                          }}
                        >
                          <span>💻 {p.name}</span>
                          <small>{p.category}</small>
                        </div>
                      ))}
                  </div>
                )}
              </form>

              {/* Toolbar */}
              <div className="discovery-toolbar">
                <button
                  type="button"
                  className="mobile-filter-open"
                  onClick={() => setMobileFiltersOpen(true)}
                >
                  Filters {activeChips.length > 0 && `(${activeChips.length})`}
                </button>

                <span role="status" style={{ fontWeight: 600 }}>
                  1–{filteredProducts.length} of {filteredProducts.length} results
                  {query && ` for "${query}"`}
                </span>

                <label className="sort-label">
                  Sort by{' '}
                  <select
                    value={sort}
                    onChange={(e) =>
                      setSort(e.target.value as 'featured' | 'low' | 'high')
                    }
                  >
                    <option value="featured">Featured</option>
                    <option value="low">Price: Low to High</option>
                    <option value="high">Price: High to Low</option>
                  </select>
                </label>
              </div>

              {/* Active Filter Chips */}
              {activeChips.length > 0 && (
                <div className="active-filters">
                  {activeChips.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      className="filter-chip"
                      onClick={chip.onRemove}
                    >
                      <span>{chip.label}</span>
                      <span aria-hidden="true">×</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="text-button"
                    style={{ fontSize: 12, marginLeft: 8 }}
                    onClick={clearAllFilters}
                  >
                    Clear all
                  </button>
                </div>
              )}

              {/* Product Cards Grid */}
              <div className="products">
                {paginated.length > 0 ? (
                  paginated.map((p) => {
                    const saving = calculateSaving(p.mrp, p.price);
                    const isCompared = compareIds.includes(p.id);

                    return (
                      <article key={p.id} className="product">
                        {p.isBestSeller && (
                          <span className="amazon-badge">Best Seller</span>
                        )}

                        <button
                          type="button"
                          className="product-art"
                          onClick={() => handleQuickView(p.id)}
                          aria-label={`View quick details for ${p.name}`}
                        >
                          <DeviceArt product={p} variant="card" />
                          {saving && (
                            <span className="saving">SAVE {formatINR(saving)}</span>
                          )}
                        </button>

                        <h3 className="product-card-title">
                          <button
                            type="button"
                            className="text-button product-title-btn"
                            onClick={() => handleQuickView(p.id)}
                          >
                            {p.name}
                          </button>
                        </h3>

                        {/* Amazon-Style Rating Stars */}
                        <div className="product-rating-row">
                          <span className="star-icons">★★★★☆</span>
                          <span className="rating-num">{p.rating || 4.6}</span>
                          <span className="reviews-count">({p.reviewsCount || 120})</span>
                        </div>

                        <div className="specs">
                          {p.cpu && <span className="spec-cpu">{p.cpu}</span>}
                          <span className="spec-details">{p.specs}</span>
                        </div>

                        <div className="product-price">
                          <span className="current-price-val">{formatINR(p.price)}</span>
                          {p.mrp && <del className="mrp-val">{formatINR(p.mrp)}</del>}
                        </div>

                        <div className="delivery-promise">
                          <span>✓</span> FREE standard delivery above ₹5,000
                        </div>

                        <button
                          type="button"
                          className="btn product-add-btn"
                          onClick={() => addToCart(p.id)}
                        >
                          Add to demo bag +
                        </button>

                        <label className="compare-check">
                          <input
                            type="checkbox"
                            checked={isCompared}
                            onChange={() => toggleCompare(p.id)}
                          />
                          <span>Compare product</span>
                        </label>
                      </article>
                    );
                  })
                ) : (
                  <div className="catalogue-empty">
                    <h3 style={{ fontSize: 20, marginBottom: 8 }}>
                      No exact match found.
                    </h3>
                    <p className="muted" style={{ marginBottom: 16 }}>
                      Try relaxing your filters or searching for another specification.
                    </p>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={clearAllFilters}
                    >
                      Clear all filters
                    </button>
                  </div>
                )}
              </div>

              {/* Pagination */}
              <div className="pagination">
                <button
                  type="button"
                  className="plain pagination-btn"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Previous
                </button>
                <span className="pagination-count">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="plain pagination-btn"
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next →
                </button>
              </div>

              {/* Personalized AI Recommendations Section */}
              {recommendations.length > 0 && (
                <div
                  style={{
                    marginTop: 50,
                    paddingTop: 30,
                    borderTop: '1px solid var(--line)',
                  }}
                >
                  <p className="eyebrow-tag">Personalized For You</p>
                  <h3 style={{ fontSize: 22, marginBottom: 16 }}>
                    Recommended from your recent searches &amp; history
                  </h3>
                  <div className="products" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                    {recommendations.map(({ product: rp, reason }) => (
                      <article key={rp.id} className="product" style={{ background: '#fdfdfb' }}>
                        <button
                          type="button"
                          className="product-art"
                          style={{ height: 160 }}
                          onClick={() => handleQuickView(rp.id)}
                        >
                          <DeviceArt product={rp} variant="card" />
                        </button>
                        <h4 style={{ margin: '10px 0 4px', fontSize: 16 }}>{rp.name}</h4>
                        <p style={{ fontSize: 12, color: 'var(--blue)', marginBottom: 8 }}>
                          💡 {reason}
                        </p>
                        <div className="product-price" style={{ fontSize: 17 }}>
                          {formatINR(rp.price)}
                        </div>
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{ minHeight: 38, padding: '8px', fontSize: 12 }}
                          onClick={() => addToCart(rp.id)}
                        >
                          Add to demo bag +
                        </button>
                      </article>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Sticky Compare Tray */}
        {compareIds.length > 0 && (
          <div className="compare-tray wrap">
            <span>
              <strong>{compareIds.length} / 3 selected</strong> ·{' '}
              {compareIds
                .map((id) => PRODUCTS.find((p) => p.id === id)?.name)
                .join(', ')}
            </span>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                type="button"
                className="text-button"
                onClick={() => setCompareIds([])}
              >
                Clear
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={compareIds.length < 2}
                onClick={openComparisonModal}
              >
                Compare side-by-side ↗
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Global Footer */}
      <Footer onOpenInfo={handleInfo} onOpenPolicy={handlePolicy} />

      {/* Accessible Modal Dialog */}
      <dialog id="panel" ref={dialogRef} aria-labelledby="panel-title">
        <div className="dialog-head">
          <h2 id="panel-title">{panelTitle}</h2>
          <button
            type="button"
            className="plain dialog-close-btn"
            aria-label="Close dialog"
            onClick={closePanel}
          >
            ×
          </button>
        </div>
        <div id="panel-body">{panelBody}</div>
      </dialog>

      {/* Mobile Overlay */}
      {mobileFiltersOpen && (
        <div
          className="filter-overlay"
          onClick={() => setMobileFiltersOpen(false)}
        />
      )}

      {/* Screen Reader Announcements */}
      <div id="announcement" className="sr-only" role="status">
        {announcement}
      </div>
    </>
  );
}

export default function SearchPage() {
  return (
    <React.Suspense
      fallback={
        <div className="wrap" style={{ padding: '80px 0', textAlign: 'center' }}>
          <p>Loading discovery catalogue…</p>
        </div>
      }
    >
      <SearchContent />
    </React.Suspense>
  );
}
