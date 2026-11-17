import { PRODUCTS, formatINR } from '../data/products';

export interface CartItem {
  id: string; // Line item ID (matches productId in demo mode, or variantId/lineId in API mode)
  productId: string;
  name: string;
  specs: string;
  image: string | null;
  quantity: number;
  maxQuantity: number;
  unitPrice: number;
  lineTotal: number;
  availability: 'UNKNOWN' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';
}

export interface CartTotals {
  subtotal: number;
  discount: number | null;
  tax: number | null;
  shipping: number | null;
  total: number | null;
  estimated: boolean;
}

export interface Cart {
  currency: 'INR';
  items: CartItem[];
  totals: CartTotals;
  canCheckout: boolean;
  customerCode?: string | null;
}

export interface CartConfig {
  mode: 'demo' | 'api';
  apiBase: string;
  storageKey: string;
  customerCodeStorageKey: string;
  routes: {
    home: string;
    shop: string;
    profile: string | null;
    checkout: string | null;
  };
  getMutationHeaders: () => Record<string, string>;
}

export const cartConfig: CartConfig = {
  mode: 'demo', // 'demo' or 'api'
  apiBase: '/api',
  storageKey: 'novatech-demo-cart',
  customerCodeStorageKey: 'novatech-customer-code',
  routes: {
    home: '/',
    shop: '/search',
    profile: '/profile',
    checkout: '/checkout',
  },
  getMutationHeaders: () => ({}),
};

// In-memory cache for zero-latency UI updates
let memoryCache: Record<string, number> = {};
let storageAvailable = true;

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const isPositiveAmount = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n >= 0;

/**
 * Validates a cart object against the API contract (API-CONTRACT.json)
 */
export function validateCart(cart: Cart): Cart {
  if (
    !cart ||
    cart.currency !== 'INR' ||
    !Array.isArray(cart.items) ||
    !cart.totals ||
    typeof cart.totals.estimated !== 'boolean' ||
    typeof cart.canCheckout !== 'boolean'
  ) {
    throw new Error('Invalid cart response from the service.');
  }

  const ids = new Set<string>();
  for (const item of cart.items) {
    if (
      typeof item.id !== 'string' ||
      !item.id ||
      ids.has(item.id) ||
      typeof item.productId !== 'string' ||
      typeof item.name !== 'string' ||
      typeof item.specs !== 'string' ||
      !Number.isSafeInteger(item.quantity) ||
      item.quantity < 1 ||
      !Number.isSafeInteger(item.maxQuantity) ||
      item.maxQuantity < 0 ||
      !isPositiveAmount(item.unitPrice) ||
      !isPositiveAmount(item.lineTotal) ||
      !(item.image === null || typeof item.image === 'string') ||
      !['UNKNOWN', 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'].includes(item.availability)
    ) {
      throw new Error('Invalid cart item from the service.');
    }
    ids.add(item.id);
  }

  if (!isPositiveAmount(cart.totals.subtotal)) {
    throw new Error('Invalid subtotal from the service.');
  }

  for (const key of ['discount', 'tax', 'shipping', 'total'] as const) {
    if (cart.totals[key] !== null && !isPositiveAmount(cart.totals[key])) {
      throw new Error('Invalid cart totals from the service.');
    }
  }

  if (!cart.totals.estimated && cart.totals.total === null) {
    throw new Error('Final total missing.');
  }

  return cart;
}

/**
 * Resolves the cache storage key.
 * If a customerCode is provided/active, scopes to 'novatech-cart_{customerCode}'
 * Otherwise defaults to 'novatech-demo-cart' for guest persistence.
 */
function resolveStorageKey(): string {
  if (typeof window === 'undefined') return cartConfig.storageKey;
  try {
    const code = localStorage.getItem(cartConfig.customerCodeStorageKey);
    if (code && code.trim()) {
      return `novatech-cart_${code.trim()}`;
    }
  } catch {}
  return cartConfig.storageKey;
}

/**
 * Reads local cached cart dictionary: { [productId]: quantity }
 */
function readLocalCache(): Record<string, number> {
  if (typeof window === 'undefined') return {};
  if (!storageAvailable) return clone(memoryCache);

  const activeKey = resolveStorageKey();
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(activeKey);
    // If scoped key is empty, check fallback guest key
    if (!raw && activeKey !== cartConfig.storageKey) {
      raw = localStorage.getItem(cartConfig.storageKey);
    }
  } catch {
    storageAvailable = false;
    return clone(memoryCache);
  }

  const clean: Record<string, number> = {};
  try {
    const data = JSON.parse(raw || '{}');
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      for (const p of PRODUCTS) {
        const qty = data[p.id];
        if (Number.isSafeInteger(qty) && qty > 0) {
          clean[p.id] = Math.min(99, qty);
        }
      }
    }
  } catch {
    // Corrupt saved data is treated as an empty cart
  }

  memoryCache = clean;
  return clone(memoryCache);
}

/**
 * Writes local cached cart dictionary to localStorage
 */
function writeLocalCache(value: Record<string, number>): void {
  memoryCache = clone(value);
  if (typeof window === 'undefined') return;

  const activeKey = resolveStorageKey();
  try {
    localStorage.setItem(activeKey, JSON.stringify(value));
    // Also keep the main guest storage key in sync for universal backward compatibility
    localStorage.setItem(cartConfig.storageKey, JSON.stringify(value));
  } catch {
    storageAvailable = false;
  }
}

/**
 * Builds the canonical Cart snapshot from the cached records & catalogue
 */
function buildSnapshot(): Cart {
  const saved = readLocalCache();
  const activeCustomerCode =
    typeof window !== 'undefined'
      ? localStorage.getItem(cartConfig.customerCodeStorageKey)
      : null;

  const items: CartItem[] = PRODUCTS.filter((p) => saved[p.id] && saved[p.id]! > 0).map((p) => {
    const qty = saved[p.id]!;
    return {
      id: p.id,
      productId: p.id,
      name: p.name,
      specs: p.specs,
      image: p.image,
      quantity: qty,
      maxQuantity: 99,
      unitPrice: p.price,
      lineTotal: p.price * qty,
      availability: 'IN_STOCK',
    };
  });

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);

  // Free shipping above ₹5,000 threshold
  const shipping = subtotal > 0 ? (subtotal >= 5000 ? 0 : 499) : null;

  return {
    currency: 'INR',
    items,
    totals: {
      subtotal,
      discount: null,
      tax: null,
      shipping,
      total: subtotal + (shipping ?? 0),
      estimated: true,
    },
    canCheckout: items.length > 0,
    customerCode: activeCustomerCode || null,
  };
}

/**
 * Network request helper for API mode
 */
async function requestApi(path: string, method = 'GET', body?: unknown): Promise<Cart> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const customerCode =
      typeof window !== 'undefined'
        ? localStorage.getItem(cartConfig.customerCodeStorageKey)
        : null;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(method !== 'GET' ? cartConfig.getMutationHeaders() : {}),
      ...(customerCode ? { 'X-Customer-Code': customerCode } : {}),
    };

    const url = `${cartConfig.apiBase.replace(/\/$/, '')}${path}`;
    const response = await fetch(url, {
      method,
      credentials: 'same-origin',
      signal: controller.signal,
      headers,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    if (!response.ok) {
      const errorMap: Record<number, string> = {
        401: 'Sign in to access your cart.',
        403: 'Cart access denied.',
        409: 'Stock or price changed. Reload the cart.',
        422: 'That quantity is not available.',
      };
      throw new Error(errorMap[response.status] || 'Unable to update the cart. Reload before retrying.');
    }

    const data = (await response.json()) as Cart;
    return validateCart(data);
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Reload the cart before retrying.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

// Mutation queue serializing modifications within the page
let mutationQueue = Promise.resolve();

function enqueueMutation(action: () => Promise<Cart>): Promise<Cart> {
  const task = mutationQueue.then(action);
  mutationQueue = task.catch(() => {}) as Promise<any>;

  return task.then((cart) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novatech:cart-updated', { detail: clone(cart) }));
    }
    return cart;
  });
}

function checkQuantity(n: number): void {
  if (!Number.isSafeInteger(n) || n < 1) {
    throw new Error('Quantity must be a positive whole number.');
  }
}

/**
 * Canonical cartApi adapter implementing the NovaTech Cart Module contract
 */
export const cartApi = {
  /**
   * Retrieves the current cart
   */
  async getCart(): Promise<Cart> {
    if (cartConfig.mode === 'api') {
      return requestApi('/cart');
    }
    return buildSnapshot();
  },

  /**
   * Adds an item to the cart (or increments existing quantity)
   */
  addItem(variantId: string, quantity = 1): Promise<Cart> {
    return enqueueMutation(async () => {
      checkQuantity(quantity);
      if (cartConfig.mode === 'api') {
        return requestApi('/cart/items', 'POST', { variantId, quantity });
      }

      const product = PRODUCTS.find((p) => p.id === variantId);
      if (!product) {
        throw new Error('Unknown product record.');
      }

      const saved = readLocalCache();
      const current = saved[variantId] || 0;
      const next = current + quantity;

      if (next > 99) {
        throw new Error('Maximum quantity is 99 units.');
      }

      saved[variantId] = next;
      writeLocalCache(saved);
      return buildSnapshot();
    });
  },

  /**
   * Updates an item's absolute quantity (or removes if 0)
   */
  setQuantity(lineId: string, quantity: number): Promise<Cart> {
    return enqueueMutation(async () => {
      if (quantity === 0) {
        return cartApi.removeItem(lineId);
      }

      checkQuantity(quantity);

      if (cartConfig.mode === 'api') {
        return requestApi(`/cart/items/${encodeURIComponent(lineId)}`, 'PATCH', { quantity });
      }

      const saved = readLocalCache();
      if (!saved[lineId] || quantity > 99) {
        throw new Error('Invalid item or quantity.');
      }

      saved[lineId] = quantity;
      writeLocalCache(saved);
      return buildSnapshot();
    });
  },

  /**
   * Removes an item from the cart
   */
  removeItem(lineId: string): Promise<Cart> {
    return enqueueMutation(async () => {
      if (cartConfig.mode === 'api') {
        return requestApi(`/cart/items/${encodeURIComponent(lineId)}`, 'DELETE');
      }

      const saved = readLocalCache();
      delete saved[lineId];
      writeLocalCache(saved);
      return buildSnapshot();
    });
  },

  /**
   * Clears all items from the cart
   */
  clearCart(): Promise<Cart> {
    return enqueueMutation(async () => {
      writeLocalCache({});
      return buildSnapshot();
    });
  },

  /**
   * Reads the active customer code
   */
  getCustomerCode(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      return localStorage.getItem(cartConfig.customerCodeStorageKey);
    } catch {
      return null;
    }
  },

  /**
   * Links the cart to a unique Customer Code.
   * Merges any existing guest cart items into the customer's account cart
   * so no picks are ever lost when logging in or entering their customer code.
   */
  setCustomerCode(code: string | null): Promise<Cart> {
    return enqueueMutation(async () => {
      if (typeof window === 'undefined') return buildSnapshot();

      const normalizedCode = code && code.trim() ? code.trim() : null;
      const currentGuestCart = readLocalCache();

      if (normalizedCode) {
        localStorage.setItem(cartConfig.customerCodeStorageKey, normalizedCode);

        // Read customer's existing saved cart if any
        const customerKey = `novatech-cart_${normalizedCode}`;
        let customerSaved: Record<string, number> = {};
        try {
          const raw = localStorage.getItem(customerKey);
          if (raw) customerSaved = JSON.parse(raw);
        } catch {}

        // Merge guest cart items into customer cart
        const merged: Record<string, number> = { ...customerSaved };
        for (const [prodId, qty] of Object.entries(currentGuestCart)) {
          merged[prodId] = Math.min(99, (merged[prodId] || 0) + qty);
        }

        try {
          localStorage.setItem(customerKey, JSON.stringify(merged));
          localStorage.setItem(cartConfig.storageKey, JSON.stringify(merged));
        } catch {}
      } else {
        localStorage.removeItem(cartConfig.customerCodeStorageKey);
      }

      return buildSnapshot();
    });
  },

  /**
   * Formats an INR price
   */
  formatPrice(amount: number): string {
    return formatINR(amount);
  },
};
