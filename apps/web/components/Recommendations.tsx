'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { DeviceArt } from './DeviceArt';
import { backendFetch } from '../lib/cart';
import { toProduct, type BackendCard } from '../lib/productMapper';
import { calculateSaving, formatINR, type Product } from '../data/products';

interface RecommendationResponse {
  strategy: 'top_rated' | 'personalized';
  basedOn: string[];
  data: (BackendCard & { reason: string })[];
}

/**
 * Home page recommendation strip (GET /api/products/recommendations).
 * Guests see top rated products; signed-in shoppers with orders see products
 * similar to what they bought. Refetches when the user signs in or out.
 */
export function Recommendations({
  onQuickView,
  onAddToCart,
}: {
  onQuickView: (productId: string) => void;
  onAddToCart: (productId: string) => void;
}) {
  const { isLoaded, isSignedIn, userId } = useAuth();
  const [state, setState] = useState<{ strategy: RecommendationResponse['strategy']; basedOn: string[]; items: (Product & { reason: string })[] } | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    backendFetch<RecommendationResponse>('/api/products/recommendations?limit=8')
      .then((r) => setState({ strategy: r.strategy, basedOn: r.basedOn, items: r.data.map((c) => ({ ...toProduct(c), reason: c.reason })) }))
      .catch(() => setState(null));
  }, [isLoaded, isSignedIn, userId]);

  if (!state || state.items.length === 0) return null;
  const personalized = state.strategy === 'personalized';

  return (
    <section id="recommended" className="section catalogue-section wrap" aria-labelledby="recommended-title">
      <div className="section-header">
        <div>
          <p className="eyebrow-tag">{personalized ? 'Picked for you' : 'Top rated'}</p>
          <h2 id="recommended-title" className="section-title">
            {personalized ? 'Recommended for you.' : 'Loved by NovaTech customers.'}
          </h2>
          <p className="muted" style={{ marginTop: 6 }}>
            {personalized
              ? `Based on your orders: ${state.basedOn.join(', ')}.`
              : 'The highest rated products in the store right now.'}
          </p>
        </div>
      </div>

      <div className="products">
        {state.items.map((p) => {
          const saving = calculateSaving(p.mrp, p.price);
          return (
            <article key={p.id} className="product">
              <button
                type="button"
                className="product-art"
                onClick={() => onQuickView(p.id)}
                aria-label={`View quick details for ${p.name}`}
              >
                <DeviceArt product={p} variant="card" />
                {saving && <span className="saving">SAVE {formatINR(saving)}</span>}
              </button>
              <h3 className="product-card-title">
                <button type="button" className="text-button product-title-btn" onClick={() => onQuickView(p.id)}>
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
              <div className="stock">{p.reason}</div>
              <button
                type="button"
                className="btn product-add-btn"
                onClick={() => onAddToCart(p.id)}
                aria-label={`Add ${p.name} to shopping bag`}
              >
                <span>Add to bag</span>
                <span className="btn-icon" aria-hidden="true">+</span>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}
