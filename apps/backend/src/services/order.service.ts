import type { OrderStatus, PaymentMethod, Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { appConfig } from "../config/app";
import { HttpError, round2 } from "../lib/http";
import { getCart, removeOrderedItemsFromCart, type CartView } from "./cart.service";
import { invalidateSearchCache } from "./product.service";

export interface ShippingAddress {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

const orderInclude = {
  items: true,
  payments: { orderBy: { createdAt: "desc" } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

// One query per cart line inside the transaction; give remote DBs (Neon) room beyond Prisma's 5s default.
const TX_OPTIONS = { maxWait: 5000, timeout: 20000 };

// ---------- pricing ----------

export function computeTotals(subtotal: number) {
  const shippingFee = subtotal === 0 || subtotal >= appConfig.freeShippingThreshold ? 0 : appConfig.shippingFee;
  const tax = round2(subtotal * appConfig.taxRate);
  return { subtotal: round2(subtotal), shippingFee, tax, total: round2(subtotal + shippingFee + tax) };
}

// ---------- serializers ----------

export function toOrderView(order: OrderWithRelations) {
  const estimatedDelivery =
    order.status === "PAID" && order.paidAt
      ? new Date(order.paidAt.getTime() + appConfig.estimatedDeliveryDays * 24 * 60 * 60 * 1000)
      : null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    tax: order.tax,
    total: order.total,
    shippingAddress: order.shippingAddress as unknown as ShippingAddress,
    items: order.items.map((i) => ({
      productId: i.productId,
      slug: i.slug,
      title: i.title,
      image: i.image,
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
    payment: order.payments[0]
      ? {
          id: order.payments[0].id,
          status: order.payments[0].status,
          method: order.payments[0].method,
          amount: order.payments[0].amount,
          transactionId: order.payments[0].transactionId,
          failureReason: order.payments[0].failureReason,
          createdAt: order.payments[0].createdAt,
        }
      : null,
    paymentAttempts: order.payments.length,
    expiresAt: order.status === "PENDING_PAYMENT" ? order.expiresAt : null,
    estimatedDelivery,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    cancelledAt: order.cancelledAt,
  };
}

// ---------- checkout ----------

export async function getCheckoutSummary(userId: string): Promise<{ cart: CartView; totals: ReturnType<typeof computeTotals>; canPlaceOrder: boolean }> {
  const cart = await getCart({ kind: "user", userId });
  return {
    cart,
    totals: computeTotals(cart.subtotal),
    canPlaceOrder: cart.items.length > 0 && !cart.hasIssues,
  };
}

function generateOrderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").toUpperCase().slice(0, 7);
  return `XM-${date}-${suffix}`;
}

async function releaseStock(tx: Prisma.TransactionClient, items: { productId: string | null; quantity: number }[]) {
  for (const item of items) {
    if (!item.productId) continue;
    await tx.product.updateMany({
      where: { id: item.productId },
      data: { stockCount: { increment: item.quantity }, inStock: true },
    });
  }
}

/** Cancels an order if it is still in `fromStatus`; returns false if someone else changed it first. */
async function cancelInTx(
  tx: Prisma.TransactionClient,
  order: { id: string; status: OrderStatus; items: { productId: string | null; quantity: number }[] },
): Promise<boolean> {
  const res = await tx.order.updateMany({
    where: { id: order.id, status: order.status },
    data: { status: "CANCELLED", cancelledAt: new Date(), expiresAt: null },
  });
  if (res.count === 0) return false;
  await releaseStock(tx, order.items);
  return true;
}

/**
 * Turns the user's cart into an order awaiting payment. Stock is reserved now
 * (so nobody else can buy the last unit while this user is paying) and given back
 * if the order is cancelled or not paid within `pendingOrderTtlMinutes`.
 * Any older unpaid order of this user is cancelled, so double-clicks don't pile up.
 */
export async function placeOrder(userId: string, shippingAddress: ShippingAddress) {
  let soldOut = false;

  const order = await prisma.$transaction(async (tx) => {
    const previous = await tx.order.findMany({
      where: { userId, status: "PENDING_PAYMENT" },
      select: { id: true, status: true, items: { select: { productId: true, quantity: true } } },
    });
    for (const p of previous) await cancelInTx(tx, p);

    const cart = await tx.cart.findUnique({
      where: { userId },
      include: { items: { orderBy: { createdAt: "asc" }, include: { product: true } } },
    });
    if (!cart || cart.items.length === 0) {
      throw new HttpError(400, "Your cart is empty", "CART_EMPTY");
    }

    for (const item of cart.items) {
      const reserved = await tx.product.updateMany({
        where: { id: item.productId, inStock: true, stockCount: { gte: item.quantity } },
        data: { stockCount: { decrement: item.quantity } },
      });
      if (reserved.count === 0) {
        throw new HttpError(
          409,
          `Only ${Math.max(item.product.stockCount, 0)} of "${item.product.title}" left in stock. Update your cart and try again.`,
          "INSUFFICIENT_STOCK",
        );
      }
    }
    const markedOut = await tx.product.updateMany({
      where: { id: { in: cart.items.map((i) => i.productId) }, stockCount: { lte: 0 } },
      data: { inStock: false },
    });
    soldOut = markedOut.count > 0;

    const lines = cart.items.map((i) => ({
      productId: i.productId,
      title: i.product.title,
      slug: i.product.slug,
      image: i.product.images[0] ?? null,
      unitPrice: i.product.price,
      quantity: i.quantity,
      lineTotal: round2(i.product.price * i.quantity),
    }));
    const totals = computeTotals(lines.reduce((sum, l) => sum + l.lineTotal, 0));

    return await tx.order.create({
      data: {
        orderNumber: generateOrderNumber(),
        userId,
        ...totals,
        shippingAddress: shippingAddress as unknown as Prisma.InputJsonObject,
        expiresAt: new Date(Date.now() + appConfig.pendingOrderTtlMinutes * 60 * 1000),
        items: { create: lines },
      },
      include: orderInclude,
    });
  }, TX_OPTIONS);

  // Products that just sold out should drop out of "in stock" search results.
  if (soldOut) await invalidateSearchCache();
  return toOrderView(order);
}

// ---------- reading ----------

async function findOwnOrder(userId: string, orderId: string) {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: orderInclude });
  if (!order) throw new HttpError(404, "Order not found", "ORDER_NOT_FOUND");
  return order;
}

export async function getOrder(userId: string, orderId: string) {
  return toOrderView(await findOwnOrder(userId, orderId));
}

export async function listOrders(userId: string, opts: { page: number; limit: number; status?: OrderStatus }) {
  const where: Prisma.OrderWhereInput = { userId, ...(opts.status ? { status: opts.status } : {}) };
  const skip = (opts.page - 1) * opts.limit;
  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({ where, include: orderInclude, orderBy: { createdAt: "desc" }, skip, take: opts.limit }),
  ]);
  return {
    data: orders.map(toOrderView),
    pagination: {
      total,
      page: opts.page,
      limit: opts.limit,
      totalPages: Math.ceil(total / opts.limit),
      hasMore: skip + orders.length < total,
    },
  };
}

// ---------- mock payment ----------

const mockTransactionId = () => `mock_txn_${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

export type PaymentOutcome =
  | { ok: true; order: ReturnType<typeof toOrderView> }
  | { ok: false; reason: string; order: ReturnType<typeof toOrderView> };

/**
 * Mock payment gateway. No money moves. `simulate: "failure"` records a declined
 * payment and leaves the order payable (the user can retry until it expires).
 */
export async function payForOrder(
  userId: string,
  orderId: string,
  method: PaymentMethod,
  simulate: "success" | "failure",
): Promise<PaymentOutcome> {
  const order = await findOwnOrder(userId, orderId);

  if (order.status === "PAID") throw new HttpError(409, "This order is already paid", "ALREADY_PAID");
  if (order.status === "CANCELLED") throw new HttpError(409, "This order was cancelled", "ORDER_CANCELLED");
  if (order.expiresAt && order.expiresAt < new Date()) {
    await prisma.$transaction((tx) => cancelInTx(tx, order));
    await invalidateSearchCache();
    throw new HttpError(410, "This order expired before payment. Please place it again.", "ORDER_EXPIRED");
  }

  if (simulate === "failure") {
    const reason = "Payment declined by mock gateway";
    await prisma.payment.create({
      data: { orderId, amount: order.total, method, status: "FAILED", transactionId: mockTransactionId(), failureReason: reason },
    });
    return { ok: false, reason, order: await getOrder(userId, orderId) };
  }

  await prisma.$transaction(async (tx) => {
    const res = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING_PAYMENT" },
      data: { status: "PAID", paidAt: new Date(), expiresAt: null },
    });
    if (res.count === 0) throw new HttpError(409, "Order is no longer awaiting payment", "ORDER_STATE_CHANGED");

    await tx.payment.create({
      data: { orderId, amount: order.total, method, status: "SUCCEEDED", transactionId: mockTransactionId() },
    });
    await removeOrderedItemsFromCart(tx, userId, order.items);
  }, TX_OPTIONS);

  return { ok: true, order: await getOrder(userId, orderId) };
}

// ---------- cancellation ----------

/** Cancels an unpaid or paid order and returns its stock. Paid orders get a mock refund record. */
export async function cancelOrder(userId: string, orderId: string) {
  const order = await findOwnOrder(userId, orderId);
  if (order.status === "CANCELLED") throw new HttpError(409, "Order is already cancelled", "ORDER_CANCELLED");

  await prisma.$transaction(async (tx) => {
    const cancelled = await cancelInTx(tx, order);
    if (!cancelled) throw new HttpError(409, "Order changed while cancelling, please retry", "ORDER_STATE_CHANGED");

    const paid = order.payments.find((p) => p.status === "SUCCEEDED");
    if (order.status === "PAID" && paid) {
      await tx.payment.create({
        data: { orderId, amount: paid.amount, method: paid.method, status: "REFUNDED", transactionId: mockTransactionId() },
      });
    }
  });

  await invalidateSearchCache();
  return await getOrder(userId, orderId);
}

/** Background job: cancel unpaid orders past their expiry and give their stock back. */
export async function expireStaleOrders(): Promise<number> {
  const stale = await prisma.order.findMany({
    where: { status: "PENDING_PAYMENT", expiresAt: { lt: new Date() } },
    select: { id: true, status: true, items: { select: { productId: true, quantity: true } } },
    take: 100,
  });
  let count = 0;
  for (const order of stale) {
    if (await prisma.$transaction((tx) => cancelInTx(tx, order))) count++;
  }
  if (count > 0) await invalidateSearchCache();
  return count;
}
