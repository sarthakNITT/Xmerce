'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { CategoryType } from '../data/products';
import { formatINR, calculateSaving } from '../data/products';
import { useProducts } from '../lib/catalog';
import { useCartMap } from '../lib/useCartMap';
import { POLICIES, INTEGRATION_INFOS } from '../data/policies';
import { Header } from '../components/Header';
import { Hero } from '../components/Hero';
import { Categories } from '../components/Categories';
import { Catalogue } from '../components/Catalogue';
import { AiShoppingAssistant } from '../components/AiShoppingAssistant';
import { PolicyAssistant } from '../components/PolicyAssistant';
import { Footer } from '../components/Footer';
import { DeviceArt } from '../components/DeviceArt';

const CART_STORAGE_KEY = 'novatech-demo-cart';

export default function HomePage() {
  const PRODUCTS = useProducts();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All');
  // Bag contents come from the backend cart (apps/backend /api/cart).
  const { cart, add: addCartItem, step: stepCartItem, remove: removeCartItem } = useCartMap();
  // The old localStorage bag sync below is kept as a no-op until it is removed.
  const setCart = (_: unknown) => {};
  const [announcement, setAnnouncement] = useState('');

  // Dialog state
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [panelTitle, setPanelTitle] = useState('');
  const [panelBody, setPanelBody] = useState<React.ReactNode>(null);

  // 1. Recover Cart from localStorage & sync across tabs
  useEffect(() => {
    const syncCart = () => {
      try {
        const saved = localStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            const validatedCart: Record<string, number> = {};
            // Keep saved ids until the catalogue has loaded from the backend.
            for (const [id, qty] of Object.entries(parsed as Record<string, unknown>)) {
              if (PRODUCTS.length && !PRODUCTS.some((p) => p.id === id)) continue;
              if (typeof qty === 'number' && Number.isInteger(qty) && qty > 0) {
                validatedCart[id] = Math.min(qty, 99);
              }
            }
            setCart(validatedCart);
          }
        }
      } catch {}
    };

    syncCart();
    window.addEventListener('storage', syncCart);
    window.addEventListener('novatech:cart-updated', syncCart);
    return () => {
      window.removeEventListener('storage', syncCart);
      window.removeEventListener('novatech:cart-updated', syncCart);
    };
  }, [PRODUCTS]);

  // 2. Persist Cart on updates
  const persistCart = useCallback((updated: Record<string, number>) => {
    setCart(updated);
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent('novatech:cart-updated'));
    } catch {
      // Ignore write errors
    }
  }, []);

  // Cart count
  const cartCount = Object.values(cart).reduce((sum, qty) => sum + qty, 0);

  // Close Dialog
  const closePanel = useCallback(() => {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, []);

  // Open Dialog helper
  const openPanel = useCallback((title: string, content: React.ReactNode) => {
    setPanelTitle(title);
    setPanelBody(content);
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, []);

  // Cart operations
  const addToCart = useCallback((productId: string) => {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return;
    addCartItem(productId);
    setAnnouncement(`${product.name} added to your bag.`);
  }, [PRODUCTS, addCartItem]);

  const updateQuantity = useCallback((productId: string, step: number) => {
    stepCartItem(productId, step, cart[productId] || 0);
  }, [cart, stepCartItem]);

  const removeItem = useCallback((productId: string) => {
    removeCartItem(productId);
  }, [removeCartItem]);

  // Show Cart in Dialog
  const showCart = useCallback(() => {
    const entries = Object.entries(cart);
    const subtotal = entries.reduce((sum, [id, q]) => {
      const p = PRODUCTS.find((item) => item.id === id);
      return sum + (p ? p.price * q : 0);
    }, 0);

    const content = entries.length > 0 ? (
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
                    aria-label={`Reduce ${p.name} quantity`}
                    onClick={() => updateQuantity(id, -1)}
                  >
                    −
                  </button>
                  <span className="cart-qty-num">{q}</span>
                  <button
                    type="button"
                    data-quantity={id}
                    data-step="1"
                    aria-label={`Increase ${p.name} quantity`}
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
          Demo bag saved in this browser. Stock is unverified. Final tax, shipping, discounts and total require the checkout service.
        </p>

        <div style={{ display: 'grid', gap: 10, marginTop: 14 }}>
          <a
            href="/cart"
            className="button blue"
            style={{ width: '100%', justifyContent: 'center', textAlign: 'center' }}
          >
            <span>Open full cart page</span>
            <span className="btn-arrow" aria-hidden="true" style={{ marginLeft: 6 }}>↗</span>
          </a>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: '100%' }}
            data-info="checkout"
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
            <span>Checkout service preview</span>
            <span className="btn-arrow" aria-hidden="true">↗</span>
          </button>
        </div>
      </div>
    ) : (
      <div style={{ textAlign: 'center', padding: '30px 10px' }}>
        <p style={{ fontSize: 16, marginBottom: 20 }}>Your bag has room for something great.</p>
        <button type="button" className="btn btn-primary" onClick={closePanel}>
          Continue exploring
        </button>
      </div>
    );

    openPanel('Your bag', content);
  }, [cart, updateQuantity, removeItem, openPanel, closePanel]);

  // Re-sync cart dialog content when cart changes and dialog is open with 'Your bag'
  useEffect(() => {
    if (dialogRef.current?.open && panelTitle === 'Your bag') {
      showCart();
    }
  }, [cart, panelTitle, showCart]);

  // Show Quick View
  const handleQuickView = useCallback((productId: string) => {
    const product = PRODUCTS.find((p) => p.id === productId);
    if (!product) return;
    const saving = calculateSaving(product.mrp, product.price);

    openPanel(
      product.name,
      <div className="quickview-shell">
        <div className="product-art quickview-art">
          <DeviceArt product={product} variant="quickview" />
        </div>
        <p className="quickview-specs">
          {product.cpu ? `${product.cpu} · ` : ''}
          {product.specs}
        </p>
        {product.videoBatteryLife && (
          <p className="quickview-battery">🔋 {product.videoBatteryLife}</p>
        )}
        <div className="product-price quickview-price">
          <span className="current-price-val">{formatINR(product.price)}</span>
          {product.mrp && <del className="mrp-val">{formatINR(product.mrp)}</del>}
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
          data-add={product.id}
          onClick={() => {
            addToCart(product.id);
            closePanel();
          }}
        >
          Add to demo bag +
        </button>
      </div>
    );
  }, [openPanel, closePanel, addToCart]);

  // Show Policy Details
  const handlePolicy = useCallback((key: string) => {
    const policy = POLICIES[key];
    if (!policy) {
      // Unsupported question / topic refusal
      openPanel(
        'Ask NovaTech',
        <div>
          <p style={{ marginBottom: 12 }}>
            The approved excerpts in this demo do not contain an answer to that question.
          </p>
          <p style={{ marginBottom: 8 }}>
            <strong>Confidence: LOW</strong> · Follow-up required: Yes
          </p>
          <p className="muted" style={{ marginBottom: 16 }}>No supporting source found.</p>
          <button
            type="button"
            className="btn btn-primary"
            data-info="support"
            onClick={() => {
              const info = INTEGRATION_INFOS.support;
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
            Contact support ↗
          </button>
        </div>
      );
      return;
    }

    openPanel(
      'Ask NovaTech',
      <div>
        <p className="policy-answer-text">{policy.content}</p>
        <p className="policy-meta-badge">
          <strong>Confidence: {policy.confidence}</strong> · Follow-up required:{' '}
          {policy.followUpRequired ? 'Yes' : 'No'}
        </p>
        <details className="policy-source-details" open>
          <summary>
            Source: {policy.documentTitle} · {policy.version}
          </summary>
          <p className="policy-source-section">Section: {policy.section}</p>
          <blockquote className="policy-quote">{policy.content}</blockquote>
        </details>
        <p className="notice">
          Exact seeded policy excerpt. Confidence is a demo value for this lookup, not a model evaluation. Production retrieval is not connected.
        </p>
      </div>
    );
  }, [openPanel, closePanel]);

  // Handle Custom Policy Question
  const handleCustomQuestion = useCallback((q: string) => {
    const normalized = q.toLowerCase().trim();
    const exactLookup: Record<string, string> = {
      'can i return an opened laptop i bought online?': 'returns',
      'how long does a refund take?': 'refunds',
      'does gold membership include free express delivery?': 'membership',
      'does the warranty cover liquid damage?': 'warranty',
      returns: 'returns',
      refunds: 'refunds',
      delivery: 'delivery',
      warranty: 'warranty',
      membership: 'membership',
    };

    const matchedKey = exactLookup[normalized];
    handlePolicy(matchedKey || 'unsupported_query');
  }, [handlePolicy]);

  // Show Info Modal (Account, Orders, Checkout, Support)
  const handleInfo = useCallback((type: 'account' | 'orders' | 'checkout' | 'support') => {
    const info = INTEGRATION_INFOS[type];
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
  }, [openPanel, closePanel]);

  // Keyboard Escape listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dialogRef.current?.open) {
        closePanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closePanel]);

  // The hero copy is written for the NovaBook Air 14 (LAP-101).
  const heroProduct = PRODUCTS.find((p) => p.id === 'LAP-101') ?? PRODUCTS[0];
  if (!heroProduct) return null;

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      {/* Global Header */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartCount={cartCount}
        onOpenCart={showCart}
        onOpenInfo={handleInfo}
        onOpenPolicy={handlePolicy}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <main id="main">
        {/* 1. Promotional Hero */}
        <Hero
          product={heroProduct}
          onExplore={handleQuickView}
          onQuickAdd={addToCart}
        />

        {/* 2. Category Grid */}
        <Categories
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {/* 3. Catalogue Grid */}
        <Catalogue
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onQuickView={handleQuickView}
          onAddToCart={addToCart}
        />

        {/* 4. AI Shopping Assistant */}
        <AiShoppingAssistant onAddToCart={addToCart} />

        {/* 5. Policy Assistant ("Ask NovaTech") & NovaClub */}
        <PolicyAssistant
          onSelectPolicy={handlePolicy}
          onCustomQuestion={handleCustomQuestion}
        />
      </main>

      {/* Global Footer */}
      <Footer onOpenInfo={handleInfo} onOpenPolicy={handlePolicy} />

      {/* Accessible Modal Dialog */}
      <dialog id="panel" ref={dialogRef} aria-labelledby="panel-title">
        <div className="dialog-head">
          <h2 id="panel-title">{panelTitle}</h2>
          <button
            type="button"
            id="close"
            className="plain dialog-close-btn"
            aria-label="Close dialog"
            onClick={closePanel}
          >
            ×
          </button>
        </div>
        <div id="panel-body">{panelBody}</div>
      </dialog>

      {/* Accessible Live Region */}
      <div id="announcement" className="sr-only" role="status">
        {announcement}
      </div>
    </>
  );
}
