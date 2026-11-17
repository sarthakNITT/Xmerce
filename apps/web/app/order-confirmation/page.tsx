import OrderConfirmation from "../../order-confirmation/OrderConfirmation";
import { DEMO_NUMBER } from "../../order-confirmation/order-service";

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ variant?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const variant = sp?.variant || 'paid';
  return <OrderConfirmation orderNumber={DEMO_NUMBER} demoVariant={variant} />;
}
