import { NextRequest, NextResponse } from 'next/server';
import { orderService } from '../../../../../order-confirmation/order-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const updated = await orderService.cancelOrder(orderNumber);
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Cannot cancel order' },
      { status: 409 }
    );
  }
}
