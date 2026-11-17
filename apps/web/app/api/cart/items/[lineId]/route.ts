import { NextRequest, NextResponse } from 'next/server';
import { resolveServerKey, buildServerCart } from '../../route';

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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ lineId: string }> }
) {
  try {
    const { lineId } = await params;
    const key = resolveServerKey(req);
    const body = await req.json();
    const { quantity } = body;

    const n = Number(quantity);
    if (!Number.isSafeInteger(n) || n < 1 || n > 99) {
      return NextResponse.json({ error: 'That quantity is not available.' }, { status: 422 });
    }

    const store = getStore();
    const userCart = store.get(key) || {};

    if (!userCart[lineId]) {
      return NextResponse.json({ error: 'Stock or price changed. Reload the cart.' }, { status: 409 });
    }

    userCart[lineId] = n;
    store.set(key, userCart);

    const cart = buildServerCart(userCart, key === 'guest_session' ? null : key);
    return NextResponse.json(cart);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ lineId: string }> }
) {
  try {
    const { lineId } = await params;
    const key = resolveServerKey(req);
    const store = getStore();
    const userCart = store.get(key) || {};

    delete userCart[lineId];
    store.set(key, userCart);

    // As required by API contract: return full updated cart, not 204
    const cart = buildServerCart(userCart, key === 'guest_session' ? null : key);
    return NextResponse.json(cart);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
