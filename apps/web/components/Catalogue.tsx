import React, { useState, useMemo, useEffect } from 'react';
import type { Product, CategoryType } from '../data/products';
import { PRODUCTS, CATEGORIES, formatINR, calculateSaving } from '../data/products';
import { DeviceArt } from './DeviceArt';

interface CatalogueProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: CategoryType;
  onSelectCategory: (cat: CategoryType) => void;
  onQuickView: (productId: string) => void;
  onAddToCart: (productId: string) => void;
}

export const Catalogue: React.FC<CatalogueProps> = ({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onSelectCategory,
  onQuickView,
  onAddToCart,
}) => {
  const [budget, setBudget] = useState<number>(0);
  const [processor, setProcessor] = useState<string>('');
  const [ram, setRam] = useState<number>(0);
  const [sort, setSort] = useState<'featured' | 'low' | 'high'>('featured');
  const [page, setPage] = useState<number>(1);
  const [addedId, setAddedId] = useState<string | null>(null);

  // Reset page when any filter changes
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, budget, processor, ram, sort]);

  // Filtered & Sorted products
  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const matches = PRODUCTS.filter((p) => {
      // Category filter
      if (selectedCategory !== 'All' && p.category !== selectedCategory) {
        return false;
      }
      // Budget filter
      if (budget > 0 && p.price > budget) {
        return false;
      }
      // Processor filter
      if (processor && p.cpu !== processor) {
        return false;
      }
      // RAM filter
      if (ram > 0 && p.ram < ram) {
        return false;
      }
      // Free text search
      if (q) {
        const hay = `${p.name} ${p.cpu} ${p.specs} ${p.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    if (sort === 'low') {
      matches.sort((a, b) => a.price - b.price);
    } else if (sort === 'high') {
      matches.sort((a, b) => b.price - a.price);
    }

    return matches;
  }, [searchQuery, selectedCategory, budget, processor, ram, sort]);

  const itemsPerPage = 4;
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProducts.slice(start, start + itemsPerPage);
  }, [filteredProducts, currentPage, itemsPerPage]);

  const handleClearAll = () => {
    onSearchChange('');
    onSelectCategory('All');
    setBudget(0);
    setProcessor('');
    setRam(0);
    setSort('featured');
    setPage(1);
  };

  const handleAdd = (id: string) => {
    onAddToCart(id);
    setAddedId(id);
    setTimeout(() => {
      setAddedId((current) => (current === id ? null : current));
    }, 1200);
  };

  // Result summary text
  const resultSummary = useMemo(() => {
    const parts = [`${filteredProducts.length} products`];
    if (selectedCategory !== 'All') parts.push(selectedCategory);
    if (budget > 0) parts.push(`${formatINR(budget)} max`);
    if (processor) parts.push(processor);
    if (ram > 0) parts.push(`${ram} GB+`);
    if (searchQuery.trim()) parts.push(`Search: ${searchQuery.trim()}`);
    return parts.join(' · ');
  }, [filteredProducts.length, selectedCategory, budget, processor, ram, searchQuery]);

  return (
    <section id="catalogue" className="section catalogue-section wrap" aria-labelledby="catalogue-title">
      <div className="section-header">
        <div>
          <p className="eyebrow-tag">The NovaTech edit</p>
          <h2 id="catalogue-title" className="section-title">
            Find your next favourite.
          </h2>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span className="badge badge-subtle">Featured Edit</span>
          <a
            href="/search"
            className="btn btn-primary"
            style={{ minHeight: 38, padding: '6px 14px', fontSize: 12 }}
          >
            Open Dedicated Search &amp; Filters ↗
          </a>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="filters-toolbar">
        <label className="filter-field">
          <span className="filter-label">Category</span>
          <select
            id="category"
            value={selectedCategory}
            onChange={(e) => onSelectCategory(e.target.value as CategoryType)}
            className="filter-select"
          >
            <option value="All">All products</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </label>

        <label className="filter-field">
          <span className="filter-label">Budget</span>
          <select
            id="budget"
            value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            className="filter-select"
          >
            <option value="0">Any budget</option>
            <option value="60000">Up to ₹60,000</option>
            <option value="70000">Up to ₹70,000</option>
            <option value="100000">Up to ₹1,00,000</option>
          </select>
        </label>

        <label className="filter-field">
          <span className="filter-label">Processor</span>
          <select
            id="processor"
            value={processor}
            onChange={(e) => setProcessor(e.target.value)}
            className="filter-select"
          >
            <option value="">Any processor</option>
            <option value="Core Ultra 5">Core Ultra 5</option>
            <option value="Core Ultra 7">Core Ultra 7</option>
            <option value="Ryzen 5">Ryzen 5</option>
            <option value="Ryzen 9">Ryzen 9</option>
            <option value="Core i5">Core i5</option>
          </select>
        </label>

        <label className="filter-field">
          <span className="filter-label">Memory</span>
          <select
            id="ram"
            value={ram}
            onChange={(e) => setRam(Number(e.target.value))}
            className="filter-select"
          >
            <option value="0">Any memory</option>
            <option value="16">16 GB or more</option>
            <option value="32">32 GB or more</option>
          </select>
        </label>

        <label className="filter-field">
          <span className="filter-label">Sort by</span>
          <select
            id="sort"
            value={sort}
            onChange={(e) => setSort(e.target.value as 'featured' | 'low' | 'high')}
            className="filter-select"
          >
            <option value="featured">Featured</option>
            <option value="low">Price: low to high</option>
            <option value="high">Price: high to low</option>
          </select>
        </label>
      </div>

      {/* Result Status Line */}
      <div className="result-line">
        <span id="result-count" role="status" className="result-count-text">
          {resultSummary}
        </span>
        <button
          type="button"
          id="clear"
          className="text-button"
          onClick={handleClearAll}
          aria-label="Reset all filters and search query"
        >
          Clear all
        </button>
      </div>

      {/* Products Grid */}
      <div id="products" className="products">
        {paginatedProducts.length > 0 ? (
          paginatedProducts.map((p) => {
            const saving = calculateSaving(p.mrp, p.price);
            const isJustAdded = addedId === p.id;

            return (
              <article key={p.id} className="product">
                <button
                  type="button"
                  className="product-art"
                  data-view={p.id}
                  onClick={() => onQuickView(p.id)}
                  aria-label={`View quick details for ${p.name}`}
                >
                  <DeviceArt product={p} variant="card" />
                  {saving && (
                    <span className="saving">
                      SAVE {formatINR(saving)}
                    </span>
                  )}
                </button>

                <h3 className="product-card-title">
                  <button
                    type="button"
                    className="text-button product-title-btn"
                    data-view={p.id}
                    onClick={() => onQuickView(p.id)}
                  >
                    {p.name}
                  </button>
                </h3>

                <div className="specs">
                  {p.cpu && <span className="spec-cpu">{p.cpu}</span>}
                  <span className="spec-details">{p.specs}</span>
                </div>

                <div className="product-price">
                  <span className="current-price-val">{formatINR(p.price)}</span>
                  {p.mrp && <del className="mrp-val">{formatINR(p.mrp)}</del>}
                </div>

                <div className="stock">
                  Stock not connected · sample pricing
                </div>

                <button
                  type="button"
                  className={`btn product-add-btn ${isJustAdded ? 'is-added' : ''}`}
                  data-add={p.id}
                  onClick={() => handleAdd(p.id)}
                  aria-label={`Add ${p.name} to shopping bag`}
                >
                  <span>{isJustAdded ? 'Added ✓' : 'Add to demo bag'}</span>
                  <span className="btn-icon" aria-hidden="true">{isJustAdded ? '✓' : '+'}</span>
                </button>
              </article>
            );
          })
        ) : (
          <div className="empty">
            <h3 className="empty-title">No products match yet.</h3>
            <p className="empty-sub">
              Try a different category, relax your budget, or clear your filters.
            </p>
            <button
              type="button"
              className="btn btn-outline"
              data-clear="true"
              onClick={handleClearAll}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="pagination">
        <button
          type="button"
          id="prev"
          className="plain pagination-btn"
          disabled={currentPage === 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          aria-label="Previous catalogue page"
        >
          ← Previous
        </button>

        <span id="page-count" className="pagination-count">
          {currentPage} / {totalPages}
        </span>

        <button
          type="button"
          id="next"
          className="plain pagination-btn"
          disabled={currentPage === totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          aria-label="Next catalogue page"
        >
          Next →
        </button>
      </div>
    </section>
  );
};
