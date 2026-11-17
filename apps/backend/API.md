# Xmerce Backend API

Base URL: `http://localhost:3001` (AI service: `http://localhost:3002`). All responses are JSON: `{ "success": true, ... }` or
`{ "success": false, "error": "message", "code": "MACHINE_CODE" }`.

## Calling the API from the frontend

```ts
fetch(`${API}/api/cart`, {
  credentials: "include", // always: carries the guest-cart cookie
  headers: {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}), // token = await getToken() from Clerk
  },
});
```

- Add your frontend origin to `CORS_ORIGINS` in `.env` (default `http://localhost:3000`).
- In production the frontend and API are usually on different sites; the cookie is then sent with
  `SameSite=None; Secure`, so the API must be served over HTTPS.

## Guest vs signed-in carts

| Who | Where the cart lives | Identified by |
|---|---|---|
| Guest | `Cart` table, `guestId` column | HttpOnly cookie `xm_guest_id` (30 days, refreshed on every change). Non-browser clients can send `X-Guest-Id` instead; it is returned as `guestId` in cart responses. |
| Signed in | `Cart` table, `userId` column | Clerk Bearer token |

Guest carts are stored on the server, so they survive the browser being closed.
The first request a guest sends **with** a Bearer token and the cookie merges the guest
cart into their user cart (same product -> quantities added, capped by stock and the
10-per-item limit) and clears the cookie. Responses report it as `mergedItems`.

**Checkout flow for a guest:** cart page -> "Proceed to checkout" -> `GET /api/checkout`
returns `401 AUTH_REQUIRED` -> send them to Clerk sign-in -> after sign-in call
`POST /api/cart/merge` (or just `GET /api/checkout` again; it merges too) -> continue.

## Endpoints

### Auth / user (Bearer token required)

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/webhook` | Clerk webhook (user created/updated/deleted -> `User` table). Not called by the frontend. |
| GET | `/api/auth/me` | `{ user }`. Creates the DB user from Clerk if the webhook hasn't synced it yet. |
| GET | `/api/users/me` | `{ user, stats: { totalOrders, paidOrders, pendingOrders, cancelledOrders, cartItemCount } }` |
| GET | `/api/users/me/purchased-products?limit=20` | Distinct products from paid orders ("Buy it again"). |

### Products (public)

| Method | Path | Notes |
|---|---|---|
| GET | `/api/products/search` | Search results page. Query: `q, category, minPrice, maxPrice, brand, color, inStock=true, minRating, sortBy=price_asc\|price_desc\|rating_desc\|newest, page, limit (max 100)`. Returns `{ data: [{ id, slug, title, price, thumbnail }], pagination, cached }`. |
| GET | `/api/products/suggest?q=nik` | Search-bar typeahead, up to 8 `{ id, slug, title, price }`. |
| GET | `/api/products/:slug` | Product page: full product + `category` + `maxOrderQuantity`. Always read from the DB (live price and stock). |

Search and suggestions are cached for 60 s (Redis if `REDIS_URL` is set, otherwise in memory),
storing only the lean card fields above. The cache is cleared when a product sells out or stock comes back.

### Cart (guest or signed in)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/cart` | | `{ cart, guestId, mergedItems }` |
| POST | `/api/cart/items` | `{ productId, quantity? = 1 }` | Adds to the quantity already in the cart. Creates the guest cart + cookie on first add. |
| PATCH | `/api/cart/items/:productId` | `{ quantity }` | Sets the exact quantity; `0` removes it. |
| DELETE | `/api/cart/items/:productId` | | Remove one product. |
| DELETE | `/api/cart` | | Empty the cart. |
| POST | `/api/cart/merge` | | Signed in only. Call right after sign-in. |

`cart` shape:
```json
{
  "id": "…", "isGuest": true, "itemCount": 3, "subtotal": 349.97, "hasIssues": false,
  "items": [{ "productId": "…", "slug": "…", "title": "…", "image": "…", "unitPrice": 159.99,
              "quantity": 1, "lineTotal": 159.99, "inStock": true, "stockCount": 45, "issue": null }]
}
```
`issue` is `null`, `"OUT_OF_STOCK"` or `"INSUFFICIENT_STOCK"`; show a warning and block checkout while `hasIssues` is true.

### Checkout, orders, mock payment (Bearer token required)

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/api/checkout` | | Order summary page: `{ cart, totals: { subtotal, shippingFee, tax, total }, canPlaceOrder }`. Free shipping from 50, else 4.99. |
| POST | `/api/orders` | `{ shippingAddress: { fullName, phone, line1, line2?, city, state, postalCode, country } }` | "Place order". Creates a `PENDING_PAYMENT` order from the cart and reserves stock for 30 min (`expiresAt`). Any older unpaid order is cancelled. `201 { order }` |
| POST | `/api/orders/:id/pay` | `{ method: "CARD"\|"UPI"\|"NET_BANKING"\|"WALLET", simulate?: "success"\|"failure" }` | **Mock payment**, no real money. Success -> `{ order }` with `status: "PAID"`, and the ordered items are removed from the cart. `simulate: "failure"` -> `402 PAYMENT_FAILED` with `order`; the user can retry until it expires. |
| GET | `/api/orders/:id` | | Order confirmation / details page. |
| GET | `/api/orders?status=PAID&page=1&limit=10` | | "Your orders". |
| POST | `/api/orders/:id/cancel` | | Unpaid -> cancelled. Paid -> cancelled + mock refund. Stock is returned. |

`order` shape:
```json
{
  "id": "…", "orderNumber": "XM-20261117-3K9Q2ZA", "status": "PAID",
  "subtotal": 159.99, "shippingFee": 0, "tax": 0, "total": 159.99,
  "shippingAddress": { "fullName": "…", "…": "…" },
  "items": [{ "productId": "…", "slug": "…", "title": "…", "image": "…", "unitPrice": 159.99, "quantity": 1, "lineTotal": 159.99 }],
  "payment": { "status": "SUCCEEDED", "method": "CARD", "amount": 159.99, "transactionId": "mock_txn_…", "failureReason": null },
  "paymentAttempts": 1, "expiresAt": null, "estimatedDelivery": "2026-11-22T…",
  "createdAt": "…", "paidAt": "…", "cancelledAt": null
}
```

Order items keep a snapshot of title, price and image, so order history stays correct if a product changes later.

## Error codes the frontend should handle

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `CART_EMPTY`, `CART_FULL`, `QUANTITY_LIMIT` | Bad input |
| 401 | `UNAUTHORIZED` | Missing, expired or invalid Clerk token |
| 401 | `AUTH_REQUIRED` | Guest tried to check out: send them to sign-in |
| 402 | `PAYMENT_FAILED` | Mock payment declined; retry allowed |
| 404 | `PRODUCT_NOT_FOUND`, `ORDER_NOT_FOUND`, `NOT_IN_CART` | |
| 409 | `OUT_OF_STOCK`, `INSUFFICIENT_STOCK` | Stock changed; refresh the cart |
| 409 | `ALREADY_PAID`, `ORDER_CANCELLED`, `ORDER_STATE_CHANGED` | Refetch the order |
| 410 | `ORDER_EXPIRED` | Unpaid for 30 min; stock released, place the order again |

## Background job

Every 5 minutes the server cancels unpaid orders past `expiresAt` (returning their stock)
and deletes guest carts untouched for 30 days.

## Setup

```bash
bun install
bun run db:push      # create the new Cart / CartItem / Order / OrderItem / Payment tables
bun run db:seed      # sample products
bun run dev
```
