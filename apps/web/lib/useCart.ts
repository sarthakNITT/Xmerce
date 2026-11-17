'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Cart, CartItem } from './cart';
import { cartApi, cartConfig } from './cart';

export function useCart() {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customerCode, setCustomerCodeState] = useState<string | null>(null);

  const refreshCart = useCallback(async () => {
    try {
      const data = await cartApi.getCart();
      setCart(data);
      setCustomerCodeState(cartApi.getCustomerCode());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Unable to load cart.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial fetch on mount
    void refreshCart();

    // Listen for custom cart-updated events from anywhere in the window
    const handleCartUpdated = (e: CustomEvent<Cart>) => {
      setCart(e.detail);
      setCustomerCodeState(cartApi.getCustomerCode());
      setError(null);
    };

    // Listen for cross-tab storage changes
    const handleStorage = (e: StorageEvent) => {
      if (
        e.key === cartConfig.storageKey ||
        e.key === cartConfig.customerCodeStorageKey ||
        (e.key && e.key.startsWith('novatech-cart_')) ||
        e.key === null
      ) {
        void refreshCart();
      }
    };

    window.addEventListener('novatech:cart-updated', handleCartUpdated as EventListener);
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener('novatech:cart-updated', handleCartUpdated as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, [refreshCart]);

  const addItem = useCallback(async (variantId: string, quantity = 1) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await cartApi.addItem(variantId, quantity);
      setCart(updated);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Failed to add item.');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const setQuantity = useCallback(async (lineId: string, quantity: number) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await cartApi.setQuantity(lineId, quantity);
      setCart(updated);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Failed to update quantity.');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const removeItem = useCallback(async (lineId: string) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await cartApi.removeItem(lineId);
      setCart(updated);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Failed to remove item.');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const clearCart = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const updated = await cartApi.clearCart();
      setCart(updated);
      return updated;
    } catch (err: any) {
      setError(err.message || 'Failed to clear cart.');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const setCustomerCode = useCallback(async (code: string | null) => {
    setBusy(true);
    setError(null);
    try {
      const updated = await cartApi.setCustomerCode(code);
      setCart(updated);
      setCustomerCodeState(cartApi.getCustomerCode());
      return updated;
    } catch (err: any) {
      setError(err.message || 'Failed to update customer code.');
      throw err;
    } finally {
      setBusy(false);
    }
  }, []);

  const cartCount =
    cart?.items.reduce((sum: number, item: CartItem) => sum + item.quantity, 0) ?? 0;

  return {
    cart,
    cartCount,
    loading,
    busy,
    error,
    customerCode,
    addItem,
    setQuantity,
    removeItem,
    clearCart,
    setCustomerCode,
    reload: refreshCart,
  };
}
