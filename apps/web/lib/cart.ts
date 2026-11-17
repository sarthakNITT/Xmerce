import { formatINR } from '../data/products';
import { getProducts } from './catalog';

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
  mode: 'api', // cart lives in the backend (apps/backend /api/cart)
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
 * Backend-backed cart (apps/backend). Guests are identified by the backend's
 * HttpOnly guest cookie; signed-in users by their Clerk session token. When a
 * guest signs in, the backend merges the guest cart into the user's cart.
 */

interface BackendCartItem {
  productId: string;
  slug: string;
  title: string;
  image: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  inStock: boolean;
  stockCount: number;
  issue: 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK' | null;
}

interface BackendCart {
  items: BackendCartItem[];
  itemCount: number;
  subtotal: number;
  hasIssues: boolean;
}

/**
 * fetch() to the backend through the same-origin proxy (app/api/store), which
 * attaches the signed-in user's Clerk token on the server and keeps the guest
 * cart cookie first-party. `path` is the backend path, e.g. "/api/cart".
 */
export async function backendFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const proxied = path.replace(/^\/api\//, '/api/store/');
  const res = await fetch(proxied, {
    ...init,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error || `Request failed (${res.status})`) as Error & { status?: number; code?: string; body?: unknown };
    err.status = res.status;
    err.code = body.code;
    err.body = body;
    throw err;
  }
  return body as T;
}

function toCart(b: BackendCart): Cart {
  const catalog = getProducts();
  const items: CartItem[] = b.items.map((i) => ({
    id: i.productId,
    productId: i.productId,
    name: i.title,
    specs: catalog.find((p) => p.id === i.productId)?.specs ?? '',
    image: i.image,
    quantity: i.quantity,
    maxQuantity: Math.max(1, Math.min(10, i.stockCount)),
    unitPrice: i.unitPrice,
    lineTotal: i.lineTotal,
    availability: !i.inStock ? 'OUT_OF_STOCK' : i.issue ? 'LOW_STOCK' : i.stockCount <= 5 ? 'LOW_STOCK' : 'IN_STOCK',
  }));
  return {
    currency: 'INR',
    items,
    totals: { subtotal: b.subtotal, discount: null, tax: null, shipping: null, total: b.subtotal, estimated: true },
    canCheckout: items.length > 0 && !b.hasIssues,
    customerCode: null,
  };
}

const cartCall = async (path: string, init?: RequestInit) => toCart((await backendFetch<{ cart: BackendCart }>(path, init)).cart);

// Serialise mutations within the page and broadcast the new cart to every listener.
let mutationQueue: Promise<unknown> = Promise.resolve();
function enqueueMutation(action: () => Promise<Cart>): Promise<Cart> {
  const task = mutationQueue.then(action);
  mutationQueue = task.catch(() => {});
  return task.then((cart) => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('novatech:cart-updated', { detail: cart }));
    }
    return cart;
  });
}

function checkQuantity(n: number): void {
  if (!Number.isSafeInteger(n) || n < 0) {
    throw new Error('Quantity must be a positive whole number.');
  }
}

export const cartApi = {
  getCart(): Promise<Cart> {
    return cartCall('/api/cart');
  },

  /** Adds `quantity` of a product (productId) to the cart. */
  addItem(productId: string, quantity = 1): Promise<Cart> {
    return enqueueMutation(async () => {
      checkQuantity(quantity);
      return cartCall('/api/cart/items', { method: 'POST', body: JSON.stringify({ productId, quantity }) });
    });
  },

  /** Sets the exact quantity; 0 removes the line. */
  setQuantity(lineId: string, quantity: number): Promise<Cart> {
    return enqueueMutation(async () => {
      checkQuantity(quantity);
      return cartCall(`/api/cart/items/${encodeURIComponent(lineId)}`, { method: 'PATCH', body: JSON.stringify({ quantity }) });
    });
  },

  removeItem(lineId: string): Promise<Cart> {
    return enqueueMutation(() => cartCall(`/api/cart/items/${encodeURIComponent(lineId)}`, { method: 'DELETE' }));
  },

  clearCart(): Promise<Cart> {
    return enqueueMutation(() => cartCall('/api/cart', { method: 'DELETE' }));
  },

  /** Moves the guest cart into the signed-in user's cart (call right after sign-in). */
  mergeGuestCart(): Promise<Cart> {
    return enqueueMutation(() => cartCall('/api/cart/merge', { method: 'POST' }));
  },

  // Customer codes were a demo-only concept; identity now comes from Clerk.
  getCustomerCode(): string | null {
    return null;
  },
  async setCustomerCode(_code: string | null): Promise<Cart> {
    return cartApi.getCart();
  },

  formatPrice(amount: number): string {
    return formatINR(amount);
  },
};
