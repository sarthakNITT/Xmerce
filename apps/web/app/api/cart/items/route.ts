import { NextRequest, NextResponse } from 'next/server';
import { PRODUCTS } from '../../../../data/products';
import { resolveServerKey, buildServerCart } from '../route';

// We share access to the serverCartStore or global map
declare global {
  // eslint-disable-next-line no-var
  var __novatechServerCartStore: Map<string, Record<string, number>> | undefined;
}

const getStore = () => {
  if (!global.__novatechServerCartStore) {
    global.__novatechServerCartStore = new Map();
  }
  return global.__novatechServerCartStore;
};

export async function POST(req: NextRequest) {
  try {
    const key = resolveServerKey(req);
    const body = await req.json();
    const { variantId, quantity } = body;

    if (!variantId || typeof variantId !== 'string') {
      return NextResponse.json({ error: 'variantId is required' }, { status: 400 });
    }

    const n = Number(quantity);
    if (!Number.isSafeInteger(n) || n < 1) {
      return NextResponse.json({ error: 'That quantity is not available.' }, { status: 422 });
    }

    const product = PRODUCTS.find((p) => p.id === variantId);
    if (!product) {
      return NextResponse.json({ error: 'Stock or price changed. Reload the cart.' }, { status: 409 });
    }

    const store = getStore();
    const userCart = store.get(key) || {};
    const nextQty = (userCart[variantId] || 0) + n;

    if (nextQty > 99) {
      return NextResponse.json({ error: 'That quantity is not available.' }, { status: 422 });
    }

    userCart[variantId] = nextQty;
    store.set(key, userCart);

    const cart = buildServerCart(userCart, key === 'guest_session' ? null : key);
    return NextResponse.json(cart);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
