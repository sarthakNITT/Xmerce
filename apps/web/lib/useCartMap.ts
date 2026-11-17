'use client';

import { useAuth } from '@clerk/nextjs';
import { useCallback, useEffect, useState } from 'react';
import type { Cart } from './cart';
import { cartApi } from './cart';

/**
 * Backend cart exposed as { productId: quantity } for pages that render their
 * own bag UI. Mutations go to apps/backend; every page stays in sync through the
 * 'novatech:cart-updated' event.
 */
export function useCartMap() {
  const { userId } = useAuth();
  const [cart, setCartState] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback((c: Cart) => {
    setCartState(Object.fromEntries(c.items.map((i) => [i.productId, i.quantity])));
  }, []);

  useEffect(() => {
    cartApi.getCart().then(apply).catch((e: Error) => setError(e.message));
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<Cart | undefined>).detail;
      if (detail) apply(detail);
      else cartApi.getCart().then(apply).catch(() => {});
    };
    window.addEventListener('novatech:cart-updated', onUpdate);
    return () => window.removeEventListener('novatech:cart-updated', onUpdate);
  }, [apply, userId]);

  const run = useCallback((p: Promise<Cart>) => {
    p.then((c) => setError(null)).catch((e: Error) => setError(e.message));
  }, []);

  const add = useCallback((productId: string, quantity = 1) => run(cartApi.addItem(productId, quantity)), [run]);
  const step = useCallback(
    (productId: string, delta: number, current: number) => {
      const next = current + delta;
      run(next <= 0 ? cartApi.removeItem(productId) : cartApi.setQuantity(productId, Math.min(next, 10)));
    },
    [run],
  );
  const remove = useCallback((productId: string) => run(cartApi.removeItem(productId)), [run]);

  return { cart, error, add, step, remove };
}
