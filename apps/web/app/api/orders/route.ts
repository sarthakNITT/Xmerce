import { NextResponse } from 'next/server';
import { createOrder, initDbAndSyncProducts } from '../../../lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { items, subtotal } = body;

    if (!items || typeof subtotal !== 'number') {
      return NextResponse.json(
        { error: 'Invalid items or subtotal' },
        { status: 400 }
      );
    }

    await initDbAndSyncProducts();
    const result = await createOrder(items, subtotal);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
