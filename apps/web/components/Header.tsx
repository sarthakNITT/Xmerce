import React from 'react';
import type { CategoryType } from '../data/products';
import { CATEGORIES } from '../data/products';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  cartCount: number;
  onOpenCart: () => void;
  onOpenInfo: (key: 'account' | 'orders' | 'checkout' | 'support') => void;
  onOpenPolicy: (key: string) => void;
  selectedCategory: CategoryType;
  onSelectCategory: (cat: CategoryType) => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  cartCount,
  onOpenCart,
  onOpenInfo,
  onOpenPolicy,
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <header className="site-header">
      {/* 1. Utility Strip */}
      <div className="utility-bar">
        <div className="wrap utility-content">
          <span className="utility-offer">
            <span className="utility-badge">Official Direct</span>
            Good things, delivered. Free standard shipping above ₹5,000.
          </span>
          <div className="utility-links">
            <button
              type="button"
              className="text-link"
              onClick={() => onOpenPolicy('delivery')}
              aria-label="View shipping and delivery details"
            >
              Delivery details
            </button>
            <span className="utility-sep" aria-hidden="true">/</span>
            <a
              href="/profile#orders"
              className="text-link"
              aria-label="Track my orders"
            >
              My orders
            </a>
          </div>
        </div>
      </div>

      {/* 2. Main Masthead */}
      <div className="wrap masthead">
        <a href="/" className="brand-logo" aria-label="NovaTech homepage">
          nova<span className="logo-accent">tech</span>
          <span className="logo-arrow">↗</span>
        </a>

        {/* Global Search Bar */}
        <form
          className="search-container"
          onSubmit={(e) => {
            e.preventDefault();
            if (searchQuery.trim()) {
              window.location.href = `/search?q=${encodeURIComponent(searchQuery.trim())}`;
            }
          }}
        >
          <label htmlFor="site-search" className="sr-only">
            Search computers, specifications, or categories
          </label>
          <div className="search-input-shell">
            <svg
              className="search-icon"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <circle cx="9" cy="9" r="6" />
              <path d="M13.5 13.5L18 18" />
            </svg>
            <input
              id="site-search"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search by processor, memory, or model name…"
              autoComplete="off"
            />
            {searchQuery && (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => onSearchChange('')}
                aria-label="Clear search input"
              >
                ×
              </button>
            )}
            <button type="submit" className="header-search-button" aria-label="Search">
              ↗
            </button>
          </div>
        </form>

        {/* Actions */}
        <div className="masthead-actions">
          <a
            href="/ask"
            className="action-btn-plain ai-header-link"
            aria-label="Ask NovaTech AI"
            title="Ask NovaTech AI"
          >
            <svg className="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z" />
              <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
            </svg>
            <span className="action-label">Ask AI</span>
          </a>

          <a
            href="/profile"
            className="action-btn-plain"
            aria-label="Account sign-in, register, and profile"
          >
            <svg className="action-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <circle cx="10" cy="7" r="4" />
              <path d="M4 18c0-3.3 2.7-6 6-6s6 2.7 6 6" />
            </svg>
            <span className="action-label">My Profile</span>
          </a>

          <a
            href="/cart"
            className="bag-toggle-btn"
            aria-label={`Open shopping bag, ${cartCount} items`}
          >
            <svg className="action-icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M5 6h10l1.5 11H3.5L5 6z" />
              <path d="M7 6V4a3 3 0 016 0v2" />
            </svg>
            <span className="bag-label">Cart</span>
            <span className="bag-badge" aria-live="polite" id="cart-count">
              {cartCount}
            </span>
          </a>
        </div>
      </div>

      {/* 3. Category Navigation Strip */}
      <nav className="wrap category-nav-bar" aria-label="Product categories navigation">
        <div className="category-nav-scroll">
          <button
            type="button"
            className={`nav-tab ${selectedCategory === 'All' ? 'is-active' : ''}`}
            onClick={() => {
              onSelectCategory('All');
              document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            All Products
          </button>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              className={`nav-tab ${selectedCategory === cat ? 'is-active' : ''}`}
              onClick={() => {
                onSelectCategory(cat);
                document.getElementById('catalogue')?.scrollIntoView({ behavior: 'smooth' });
              }}
            >
              {cat}
            </button>
          ))}
        </div>
        <a href="/#assistant" className="matchmaker-shortcut">
          <span>Find my match</span>
          <span className="arrow-icon">↗</span>
        </a>
      </nav>
    </header>
  );
};
