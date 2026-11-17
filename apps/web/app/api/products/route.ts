import { NextResponse } from 'next/server';
import { fetchProductsFromDb, initDbAndSyncProducts } from '../../../lib/db';

export async function GET() {
  try {
    await initDbAndSyncProducts();
    const products = await fetchProductsFromDb();
    return NextResponse.json({ success: true, products, source: 'neon-postgresql' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
