# NovaTech Order Confirmation Module

## Scope

React frontend styled with Tailwind. Works with React Router or Next.js.

The existing NovaTech brief requires Java for the backend. This frontend is
backend-independent and does not introduce FastAPI or Express.

Backend SQL, payment processing, emails, queues and invoice generation are
not implemented by this frontend module.

## Requirements

- React with hooks.
- Tailwind configured to scan this module's JSX files.
- The site's existing build tool and development server.
- Serve all modules on the same origin where possible.

Do not load this JSX directly in an HTML script tag.

## React Router integration

Register this route inside the application's existing router:

```jsx
import { Route, useParams } from "react-router-dom";
import OrderConfirmation from "./order-confirmation/OrderConfirmation";

function OrderConfirmationRoute() {
  const { orderNumber } = useParams();
  return <OrderConfirmation orderNumber={orderNumber} />;
}

// Inside your existing <Routes>:
<Route
  path="/order-confirmation/:orderNumber"
  element={<OrderConfirmationRoute />}
/>
```

Configure the production host to serve the React application for deep links.
Refreshing /order-confirmation/:orderNumber must not return a static-host 404.

## Next.js integration

Create app/order-confirmation/[orderNumber]/page.jsx:

```jsx
import OrderConfirmation from "../../../order-confirmation/OrderConfirmation";

export default async function Page({ params }) {
  const { orderNumber } = await params;
  return <OrderConfirmation orderNumber={orderNumber} />;
}
```

Adjust the import path to match the team's folder structure.

The provided component has "use client" because it uses hooks and browser APIs.

## Demo states

```jsx
import OrderConfirmation from "./order-confirmation/OrderConfirmation";
import { DEMO_NUMBER } from "./order-confirmation/order-service";

<OrderConfirmation orderNumber={DEMO_NUMBER} demoVariant="paid" />
<OrderConfirmation orderNumber={DEMO_NUMBER} demoVariant="cod" />
<OrderConfirmation orderNumber={DEMO_NUMBER} demoVariant="pending" />
```

The pending demo remains pending. It does not invent a successful payment.

For the failed-state demo, provide an existing payment route or inject:

```jsx
<OrderConfirmation
  orderNumber={DEMO_NUMBER}
  demoVariant="failed"
  onPaymentFailed={(number) => {
    // Use the team's actual router and payment page.
    navigate(`/checkout?orderNumber=${encodeURIComponent(number)}&payment=failed`);
  }}
/>
```

Demo customer/address data is explicitly fictional.
Demo cancellations last only for the current JavaScript application session.

## Connect the backend

Change orderConfig.mode from "demo" to "api".

Required endpoints:

GET /api/orders/:orderNumber
- Owner-only authenticated access.
- Returns the complete order view model represented by demoOrder().
- Must not create orders, payments, emails or purchase events.

POST /api/orders/:orderNumber/cancel
- Owner-only.
- Rechecks cancellation eligibility on the server.
- Returns the complete updated order.
- Use transactional/idempotent cancellation behavior.
- Return 409 if the order can no longer be cancelled.

GET /api/orders/:orderNumber/invoice
- Owner-only.
- Returns application/pdf.
- Set invoiceAvailable only when the invoice is ready.

The adapter uses same-origin credentials.
Supply the team's CSRF headers through mutationHeaders() where required.

Never authorize an order by UUID alone.
Never put session secrets, database URLs or payment secrets in frontend files.

## Checkout handoff

The checkout module creates the order exactly once through the backend.

After creation, navigate to:

/order-confirmation/{orderNumber}

Pass only the order identifier.
Do not pass prices, address data, payment credentials or customer email in URLs.

The confirmation page obtains its data through GET.
Refreshing the page must never re-run place-order.

The checkout service owns:
- Idempotency keys.
- Database repricing and stock locking.
- Purchase events.
- Payment webhook verification.
- Order snapshots.
- Confirmation email queueing.

## Money

PostgreSQL money columns should use the agreed NUMERIC(10,2) contract.

Serialize decimal amounts as strings:

"64990.00"

The backend computes:

grandTotal = subtotal + shipping - discount + tax

The frontend only formats those values with Intl.NumberFormat.
Do not use frontend floating-point arithmetic as the payment authority.

## Payment variants

PAID:
- Confirmation banner and order details.

COD:
- Confirmation banner.
- Cash on delivery.
- Total due.

PENDING:
- Neutral verification banner.
- GET polling every five seconds.
- No overlapping polling requests.
- No delivery promise before confirmation.

FAILED:
- Redirect through onPaymentFailed.
- The redirect does not create or retry a payment.

Polling is cleaned up on unmount and stops at terminal states.

## Status timeline

The backend supplies three steps:

CONFIRMED -> SHIPPED -> DELIVERED

PACKED can be the current order status while the shipping milestone is upcoming.

Cancelled orders show cancellation information instead of a misleading
delivery-progress timeline.

## Product and customer information

Return immutable order snapshots for item name, specifications, image and prices.
Do not rebuild a past order from current product prices.

Return masked email and payment method/last4 only.
Never return full card numbers or payment secrets.

Recommendations should use:
- CO_PURCHASE only for actual co-purchase data.
- CURATED for manually selected suggestions.

This prevents the UI from claiming fictional "customers also bought" activity.

## Routes to configure

orderConfig.routes.shop
orderConfig.routes.support
orderConfig.routes.payment

The header home link currently points to /index.html.

Update these when joining the existing HTML modules or moving everything
into React routes.

## Before deployment

Verify:
- Owner-only GET, cancellation and invoice authorization.
- Paid, COD, pending-to-paid and pending-to-failed transitions.
- Poll cleanup when leaving the page.
- Refresh without duplicate orders.
- Cancellation racing with shipment.
- Real server totals and product snapshots.
- Masked email/card details.
- Invoice download permissions.
- Mobile layout and keyboard navigation.
- Production deep-link routing.

This is frontend template code. It has not been executed against your team's
React build or actual backend.
