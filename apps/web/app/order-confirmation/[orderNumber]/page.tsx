import OrderConfirmation from "../../../order-confirmation/OrderConfirmation";

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ orderNumber: string }>;
  searchParams?: Promise<{ variant?: string }>;
}) {
  const { orderNumber } = await params;
  const sp = searchParams ? await searchParams : {};
  const variant = sp?.variant || 'paid';
  return <OrderConfirmation orderNumber={orderNumber} demoVariant={variant} />;
}
