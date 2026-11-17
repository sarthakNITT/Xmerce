import { NextResponse } from 'next/server';
import { fetchProductsServer } from '../../../lib/catalogServer';

/** Product list for the storefront, served from the backend (apps/backend -> Postgres). */
export async function GET() {
  try {
    const products = await fetchProductsServer();
    return NextResponse.json({ success: true, products, source: 'xmerce-backend' });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 502 });
  }
}
