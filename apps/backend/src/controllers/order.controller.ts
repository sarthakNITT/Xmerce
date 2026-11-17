import type { OrderStatus, PaymentMethod } from "@prisma/client";
import {
  HttpError,
  ok,
  optionalString,
  readJson,
  requireString,
  type RequestContext,
} from "../lib/http";
import { requireAuth } from "../middlewares/auth.middleware";
import { requireUserCart } from "../middlewares/cart-owner.middleware";
import {
  cancelOrder,
  getCheckoutSummary,
  getOrder,
  listOrders,
  payForOrder,
  placeOrder,
  type ShippingAddress,
} from "../services/order.service";

const ORDER_STATUSES = new Set<OrderStatus>(["PENDING_PAYMENT", "PAID", "CANCELLED"]);
const PAYMENT_METHODS = new Set<PaymentMethod>(["CARD", "UPI", "NET_BANKING", "WALLET"]);

function parseShippingAddress(raw: unknown): ShippingAddress {
  if (!raw || typeof raw !== "object") {
    throw new HttpError(400, '"shippingAddress" is required', "VALIDATION_ERROR");
  }
  const a = raw as Record<string, unknown>;
  const phone = requireString(a.phone, "shippingAddress.phone", 20);
  if (!/^\+?[0-9\s-]{7,20}$/.test(phone)) {
    throw new HttpError(400, '"shippingAddress.phone" is not a valid phone number', "VALIDATION_ERROR");
  }
  return {
    fullName: requireString(a.fullName, "shippingAddress.fullName", 100),
    phone,
    line1: requireString(a.line1, "shippingAddress.line1"),
    line2: optionalString(a.line2, "shippingAddress.line2"),
    city: requireString(a.city, "shippingAddress.city", 100),
    state: requireString(a.state, "shippingAddress.state", 100),
    postalCode: requireString(a.postalCode, "shippingAddress.postalCode", 20),
    country: requireString(a.country, "shippingAddress.country", 100),
  };
}

/** GET /api/checkout — order summary page (cart + shipping + tax + total). */
export async function checkoutSummaryHandler(ctx: RequestContext) {
  const { auth, mergedItems } = await requireUserCart(ctx);
  return ok({ ...(await getCheckoutSummary(auth.user.id)), mergedItems });
}

/** POST /api/orders — "Place order": creates an order awaiting payment from the cart. */
export async function placeOrderHandler(ctx: RequestContext) {
  const body = await readJson(ctx.req);
  const shippingAddress = parseShippingAddress(body.shippingAddress);
  const { auth } = await requireUserCart(ctx);
  return ok({ order: await placeOrder(auth.user.id, shippingAddress) }, 201);
}

export async function listOrdersHandler(ctx: RequestContext) {
  const { user } = await requireAuth(ctx);
  const sp = ctx.url.searchParams;
  const status = sp.get("status")?.toUpperCase() as OrderStatus | undefined;
  if (status && !ORDER_STATUSES.has(status)) {
    throw new HttpError(400, `"status" must be one of ${[...ORDER_STATUSES].join(", ")}`, "VALIDATION_ERROR");
  }
  const page = Math.max(Number(sp.get("page")) || 1, 1);
  const limit = Math.min(Math.max(Number(sp.get("limit")) || 10, 1), 50);
  return ok(await listOrders(user.id, { page, limit, status }));
}

/** GET /api/orders/:id — order details / confirmation page. */
export async function getOrderHandler(ctx: RequestContext) {
  const { user } = await requireAuth(ctx);
  return ok({ order: await getOrder(user.id, ctx.params.id!) });
}

/** POST /api/orders/:id/pay — mock payment. Body: { method, simulate? } */
export async function payOrderHandler(ctx: RequestContext) {
  const { user } = await requireAuth(ctx);
  const body = await readJson(ctx.req);

  const method = String(body.method ?? "CARD").toUpperCase() as PaymentMethod;
  if (!PAYMENT_METHODS.has(method)) {
    throw new HttpError(400, `"method" must be one of ${[...PAYMENT_METHODS].join(", ")}`, "VALIDATION_ERROR");
  }
  const simulate = body.simulate === "failure" ? "failure" : "success";

  const result = await payForOrder(user.id, ctx.params.id!, method, simulate);
  if (!result.ok) {
    return Response.json(
      { success: false, error: result.reason, code: "PAYMENT_FAILED", order: result.order },
      { status: 402 },
    );
  }
  return ok({ order: result.order });
}

export async function cancelOrderHandler(ctx: RequestContext) {
  const { user } = await requireAuth(ctx);
  return ok({ order: await cancelOrder(user.id, ctx.params.id!) });
}
