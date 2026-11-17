import { NextRequest, NextResponse } from 'next/server';
import { orderService } from '../../../../order-confirmation/order-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  try {
    const { orderNumber } = await params;
    const variant = request.nextUrl.searchParams.get('variant') || 'paid';
    const order = await orderService.getOrder(orderNumber, { demoVariant: variant });
    return NextResponse.json(order);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Order not found' },
      { status: 404 }
    );
  }
}
