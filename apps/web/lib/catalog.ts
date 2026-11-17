'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { Product } from '../data/products';
import { API_URL } from './api';
import { toProduct, type BackendCard } from './productMapper';

/**
 * Product catalogue loaded from the backend (GET /api/products/search) instead of
 * the old static list in data/products.ts. One shared in-memory store: the first
 * component that needs products triggers the fetch; everyone re-renders when it lands.
 */

let products: Product[] = [];
let status: 'idle' | 'loading' | 'ready' | 'error' = 'idle';
let inflight: Promise<Product[]> | null = null;
let retries = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export async function loadProducts(force = false): Promise<Product[]> {
  if (inflight && !force) return inflight;
  status = 'loading';
  inflight = fetch(`${API_URL}/api/products/search?limit=100&sortBy=rating_desc`, { cache: 'no-store' })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Backend returned ${res.status}`);
      const body = (await res.json()) as { data: BackendCard[] };
      products = body.data.map(toProduct);
      status = 'ready';
      retries = 0;
      return products;
    })
    .catch((err) => {
      console.error('[catalog] failed to load products from backend:', err);
      status = 'error';
      inflight = null;
      // Backend may be restarting (dev --watch): retry with backoff while anyone is listening.
      if (typeof window !== 'undefined' && retries < 5) {
        retries += 1;
        setTimeout(() => {
          if (listeners.size > 0) void loadProducts();
        }, 1000 * 2 ** retries);
      }
      return products;
    })
    .finally(emit);
  return inflight;
}

/** Current snapshot (empty until loaded). Safe to call from non-React code. */
export function getProducts(): Product[] {
  return products;
}

export function getCatalogStatus() {
  return status;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: Product[] = [];

/** React hook: products from the backend; re-renders when they arrive. */
export function useProducts(): Product[] {
  const list = useSyncExternalStore(subscribe, getProducts, () => EMPTY);
  useEffect(() => {
    if (status === 'idle' || status === 'error') void loadProducts();
  }, []);
  return list;
}

export function useCatalogStatus() {
  return useSyncExternalStore(subscribe, getCatalogStatus, () => 'idle' as const);
}
