import { prisma } from "../config/db";
import { clerkClient } from "../config/clerk";

export interface SyncUserData {
  clerkId: string;
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  authProvider?: string;
}

export async function upsertUser(data: SyncUserData) {
  const fields = {
    email: data.email,
    username: data.username,
    firstName: data.firstName,
    lastName: data.lastName,
    avatarUrl: data.avatarUrl,
    authProvider: data.authProvider ?? "credentials",
  };
  return await prisma.user.upsert({
    where: { clerkId: data.clerkId },
    update: fields,
    create: { clerkId: data.clerkId, ...fields },
  });
}

export async function deleteUserByClerkId(clerkId: string) {
  return await prisma.user.deleteMany({
    where: { clerkId },
  });
}

export async function getUserByClerkId(clerkId: string) {
  return await prisma.user.findUnique({
    where: { clerkId },
  });
}

/**
 * Returns the DB user for a Clerk id, creating it from Clerk's API if the
 * webhook hasn't synced it yet (common in local dev without a tunnel).
 */
export async function ensureUser(clerkId: string) {
  const existing = await getUserByClerkId(clerkId);
  if (existing) return existing;

  const cu = await clerkClient.users.getUser(clerkId);
  const primary = cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId) ?? cu.emailAddresses[0];
  const isGoogle =
    cu.externalAccounts.some((a) => a.provider.includes("google")) ||
    (primary?.verification?.strategy ?? "").includes("oauth_google");

  return await upsertUser({
    clerkId: cu.id,
    email: primary?.emailAddress ?? `${cu.id}@users.clerk.invalid`,
    username: cu.username,
    firstName: cu.firstName,
    lastName: cu.lastName,
    avatarUrl: cu.imageUrl,
    authProvider: isGoogle ? "oauth_google" : "credentials",
  });
}

export async function getUserOverview(userId: string) {
  const [user, orderCounts, cart] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    prisma.order.groupBy({ by: ["status"], where: { userId }, _count: { _all: true } }),
    prisma.cart.findUnique({ where: { userId }, select: { items: { select: { quantity: true } } } }),
  ]);

  const counts = Object.fromEntries(orderCounts.map((c) => [c.status, c._count._all]));
  return {
    user,
    stats: {
      totalOrders: orderCounts.reduce((sum, c) => sum + c._count._all, 0),
      paidOrders: counts.PAID ?? 0,
      pendingOrders: counts.PENDING_PAYMENT ?? 0,
      cancelledOrders: counts.CANCELLED ?? 0,
      cartItemCount: cart?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0,
    },
  };
}

/** Distinct products from the user's paid orders, most recent first ("Buy it again"). */
export async function getPurchasedProducts(userId: string, limit = 20) {
  const items = await prisma.orderItem.findMany({
    where: { order: { userId, status: "PAID" } },
    orderBy: { order: { paidAt: "desc" } },
    select: {
      productId: true,
      title: true,
      slug: true,
      image: true,
      unitPrice: true,
      order: { select: { id: true, orderNumber: true, paidAt: true } },
      product: { select: { price: true, inStock: true } },
    },
    take: 200,
  });

  const seen = new Set<string>();
  const result = [];
  for (const item of items) {
    const key = item.productId ?? item.slug;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      productId: item.productId,
      slug: item.slug,
      title: item.title,
      image: item.image,
      pricePaid: item.unitPrice,
      currentPrice: item.product?.price ?? null,
      available: item.product?.inStock ?? false,
      lastOrder: item.order,
    });
    if (result.length >= limit) break;
  }
  return result;
}
