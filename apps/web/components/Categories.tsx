import React from 'react';
import type { CategoryType } from '../data/products';
import { CATEGORIES } from '../data/products';

interface CategoriesProps {
  selectedCategory: CategoryType;
  onSelectCategory: (cat: CategoryType) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  Laptops: (
    <svg viewBox="0 0 60 45" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="12" y="7" width="36" height="24" rx="2" />
      <path d="M4 35h52M22 35l2-4h12l2 4" />
    </svg>
  ),
  Desktops: (
    <svg viewBox="0 0 60 45" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="8" y="6" width="34" height="24" rx="2" />
      <path d="M18 30v5M32 30v5M12 35h26" />
      <rect x="46" y="8" width="8" height="27" rx="1.5" />
    </svg>
  ),
  'All-in-One': (
    <svg viewBox="0 0 60 45" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="6" y="4" width="48" height="30" rx="3" />
      <path d="M22 34v6M38 34v6M16 40h28" />
    </svg>
  ),
  Gaming: (
    <svg viewBox="0 0 60 45" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 18h36l-4 16H16l-4-16z" />
      <path d="M22 24h6M25 21v6M38 23h.01M42 26h.01" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  Monitors: (
    <svg viewBox="0 0 60 45" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="5" y="6" width="50" height="26" rx="2" />
      <path d="M24 32v6M36 32v6M18 38h24" />
    </svg>
  ),
  Accessories: (
    <svg viewBox="0 0 60 45" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M18 20v-4a12 12 0 1124 0v4" />
      <rect x="12" y="20" width="8" height="15" rx="3" />
      <rect x="40" y="20" width="8" height="15" rx="3" />
    </svg>
  ),
};

export const Categories: React.FC<CategoriesProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <section className="section categories-section wrap" aria-labelledby="categories-heading">
      <div className="section-header">
        <div>
          <p className="eyebrow-tag">Make it yours</p>
          <h2 id="categories-heading" className="section-title">
            A place for every possibility.
          </h2>
        </div>
        <a href="/search" className="section-action-link">
          <span>Shop all products in search</span>
          <span aria-hidden="true">↗</span>
        </a>
      </div>

      <div className="categories-grid">
        {CATEGORIES.map((cat, index) => {
          const isSelected = selectedCategory === cat;
          return (
            <a
              key={cat}
              href={`/search?category=${encodeURIComponent(cat)}`}
              className={`category-card ${isSelected ? 'is-selected' : ''}`}
              aria-pressed={isSelected}
            >
              <div className="category-icon-box">{CATEGORY_ICONS[cat]}</div>
              <div className="category-info">
                <span className="category-index">0{index + 1}</span>
                <span className="category-name">{cat}</span>
              </div>
              <span className="category-hover-arrow" aria-hidden="true">↗</span>
            </a>
          );
        })}
      </div>
    </section>
  );
};
