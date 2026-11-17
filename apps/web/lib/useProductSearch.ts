'use client';

import { useEffect, useState } from 'react';
import { API_URL } from './api';

export interface ProductSearchState {
  /** Product ids ranked by relevance, or null when there is no query. */
  ids: string[] | null;
  loading: boolean;
  engine: string | null;
  error: string | null;
}

/**
 * Search-bar query -> backend search (Meilisearch: typo-tolerant, synonyms,
 * ranked). Debounced; returns ranked product ids that pages intersect with the
 * loaded catalogue.
 */
export function useProductSearch(query: string, debounceMs = 200): ProductSearchState {
  const [state, setState] = useState<ProductSearchState>({ ids: null, loading: false, engine: null, error: null });

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setState({ ids: null, loading: false, engine: null, error: null });
      return;
    }
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/products/search?q=${encodeURIComponent(q)}&limit=100`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const body = (await res.json()) as { data: { id: string }[]; engine?: string };
        setState({ ids: body.data.map((p) => p.id), loading: false, engine: body.engine ?? null, error: null });
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState({ ids: [], loading: false, engine: null, error: (err as Error).message });
      }
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, debounceMs]);

  return state;
}
