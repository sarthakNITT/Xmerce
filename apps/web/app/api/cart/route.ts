import { NextRequest, NextResponse } from 'next/server';
import { fetchProductsServer } from '../../../lib/catalogServer';
import type { Cart, CartItem } from '../../../lib/cart';
import { validateCart } from '../../../lib/cart';

// In-memory server-side mock cart store keyed by customerCode or guest sessionId
const serverCartStore: Map<string, Record<string, number>> = new Map();

export function resolveServerKey(req: NextRequest): string {
  const customerCode =
    req.headers.get('x-customer-code') ||
    req.nextUrl.searchParams.get('customerCode') ||
    'guest_session';
  return customerCode.trim();
}

export async function buildServerCart(storage: Record<string, number>, customerCode?: string | null): Promise<Cart> {
  const PRODUCTS = await fetchProductsServer();
  const items: CartItem[] = [];

  for (const [prodId, qty] of Object.entries(storage)) {
    const p = PRODUCTS.find((item) => item.id === prodId);
    if (p && qty > 0) {
      items.push({
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
      });
    }
  }

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shipping = subtotal > 0 ? (subtotal >= 5000 ? 0 : 499) : null;

  const cart: Cart = {
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
    customerCode: customerCode || null,
  };

  return validateCart(cart);
}

export async function GET(req: NextRequest) {
  const key = resolveServerKey(req);
  const userCart = serverCartStore.get(key) || {};
  const cart = await buildServerCart(userCart, key === 'guest_session' ? null : key);
  return NextResponse.json(cart);
}
