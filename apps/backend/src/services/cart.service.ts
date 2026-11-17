import type { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { appConfig } from "../config/app";
import { HttpError, round2 } from "../lib/http";

export type CartOwner = { kind: "user"; userId: string } | { kind: "guest"; guestId: string };

const cartInclude = {
  items: {
    orderBy: { createdAt: "asc" },
    include: {
      product: {
        select: { id: true, slug: true, title: true, price: true, images: true, inStock: true, stockCount: true },
      },
    },
  },
} satisfies Prisma.CartInclude;

type CartWithItems = Prisma.CartGetPayload<{ include: typeof cartInclude }>;

export type CartItemIssue = "OUT_OF_STOCK" | "INSUFFICIENT_STOCK" | null;

export interface CartView {
  id: string | null;
  isGuest: boolean;
  items: {
    productId: string;
    slug: string;
    title: string;
    image: string | null;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
    inStock: boolean;
    stockCount: number;
    issue: CartItemIssue;
  }[];
  itemCount: number;
  subtotal: number;
  hasIssues: boolean;
}

const ownerWhere = (owner: CartOwner): Prisma.CartWhereUniqueInput =>
  owner.kind === "user" ? { userId: owner.userId } : { guestId: owner.guestId };

const guestExpiry = () => new Date(Date.now() + appConfig.guestCartTtlDays * 24 * 60 * 60 * 1000);

export function toCartView(cart: CartWithItems | null, isGuest: boolean): CartView {
  const items = (cart?.items ?? []).map((item) => {
    const p = item.product;
    const issue: CartItemIssue =
      !p.inStock || p.stockCount <= 0 ? "OUT_OF_STOCK" : item.quantity > p.stockCount ? "INSUFFICIENT_STOCK" : null;
    return {
      productId: p.id,
      slug: p.slug,
      title: p.title,
      image: p.images[0] ?? null,
      unitPrice: p.price,
      quantity: item.quantity,
      lineTotal: round2(p.price * item.quantity),
      inStock: p.inStock && p.stockCount > 0,
      stockCount: p.stockCount,
      issue,
    };
  });

  return {
    id: cart?.id ?? null,
    isGuest,
    items,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    subtotal: round2(items.reduce((sum, i) => sum + i.lineTotal, 0)),
    hasIssues: items.some((i) => i.issue !== null),
  };
}

export async function getCart(owner: CartOwner | null): Promise<CartView> {
  if (!owner) return toCartView(null, true);
  const cart = await prisma.cart.findUnique({ where: ownerWhere(owner), include: cartInclude });
  return toCartView(cart, owner.kind === "guest");
}

async function getOrCreateCartId(owner: CartOwner): Promise<string> {
  const cart =
    owner.kind === "user"
      ? await prisma.cart.upsert({ where: { userId: owner.userId }, create: { userId: owner.userId }, update: {}, select: { id: true } })
      : await prisma.cart.upsert({
          where: { guestId: owner.guestId },
          create: { guestId: owner.guestId, expiresAt: guestExpiry() },
          update: { expiresAt: guestExpiry() },
          select: { id: true },
        });
  return cart.id;
}

async function loadSellableProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, title: true, inStock: true, stockCount: true },
  });
  if (!product) throw new HttpError(404, "Product not found", "PRODUCT_NOT_FOUND");
  if (!product.inStock || product.stockCount <= 0) {
    throw new HttpError(409, `"${product.title}" is out of stock`, "OUT_OF_STOCK");
  }
  return product;
}

function assertQuantityAllowed(quantity: number, stockCount: number, title: string) {
  if (quantity > appConfig.maxQuantityPerItem) {
    throw new HttpError(400, `You can buy at most ${appConfig.maxQuantityPerItem} of "${title}"`, "QUANTITY_LIMIT");
  }
  if (quantity > stockCount) {
    throw new HttpError(409, `Only ${stockCount} of "${title}" left in stock`, "INSUFFICIENT_STOCK");
  }
}

/** Adds `quantity` to whatever is already in the cart for this product. */
export async function addItem(owner: CartOwner, productId: string, quantity: number): Promise<CartView> {
  const product = await loadSellableProduct(productId);
  const cartId = await getOrCreateCartId(owner);

  const [existing, lineCount] = await Promise.all([
    prisma.cartItem.findUnique({ where: { cartId_productId: { cartId, productId } }, select: { quantity: true } }),
    prisma.cartItem.count({ where: { cartId } }),
  ]);
  if (!existing && lineCount >= appConfig.maxCartLines) {
    throw new HttpError(400, `Cart can hold at most ${appConfig.maxCartLines} different products`, "CART_FULL");
  }

  const newQuantity = (existing?.quantity ?? 0) + quantity;
  assertQuantityAllowed(newQuantity, product.stockCount, product.title);

  await prisma.cartItem.upsert({
    where: { cartId_productId: { cartId, productId } },
    create: { cartId, productId, quantity: newQuantity },
    update: { quantity: newQuantity },
  });
  return await getCart(owner);
}

/** Sets the exact quantity; 0 removes the line. */
export async function setItemQuantity(owner: CartOwner, productId: string, quantity: number): Promise<CartView> {
  if (quantity === 0) return await removeItem(owner, productId);

  const cart = await prisma.cart.findUnique({ where: ownerWhere(owner), select: { id: true } });
  const line = cart && (await prisma.cartItem.findUnique({ where: { cartId_productId: { cartId: cart.id, productId } } }));
  if (!cart || !line) throw new HttpError(404, "Product is not in your cart", "NOT_IN_CART");

  const product = await loadSellableProduct(productId);
  assertQuantityAllowed(quantity, product.stockCount, product.title);

  await prisma.cartItem.update({ where: { id: line.id }, data: { quantity } });
  await touchGuestCart(owner);
  return await getCart(owner);
}

export async function removeItem(owner: CartOwner, productId: string): Promise<CartView> {
  const cart = await prisma.cart.findUnique({ where: ownerWhere(owner), select: { id: true } });
  if (cart) {
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id, productId } });
    await touchGuestCart(owner);
  }
  return await getCart(owner);
}

export async function clearCart(owner: CartOwner): Promise<CartView> {
  const cart = await prisma.cart.findUnique({ where: ownerWhere(owner), select: { id: true } });
  if (cart) await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  return await getCart(owner);
}

async function touchGuestCart(owner: CartOwner) {
  if (owner.kind === "guest") {
    await prisma.cart.updateMany({ where: { guestId: owner.guestId }, data: { expiresAt: guestExpiry() } });
  }
}

/**
 * Moves a guest cart into the user's cart after sign-in. Quantities for the same
 * product are added together, capped by stock and the per-item limit. The guest
 * cart is deleted afterwards. Safe to call repeatedly or concurrently.
 */
export async function mergeGuestCart(guestId: string, userId: string): Promise<{ mergedItems: number }> {
  return await prisma.$transaction(async (tx) => {
    const guest = await tx.cart.findUnique({ where: { guestId }, include: { items: true } });
    if (!guest) return { mergedItems: 0 };

    // Claim the guest cart first; a concurrent merge will see count 0 and stop.
    const claimed = await tx.cart.deleteMany({ where: { id: guest.id } });
    if (claimed.count === 0 || guest.items.length === 0) return { mergedItems: 0 };

    const userCart = await tx.cart.upsert({ where: { userId }, create: { userId }, update: {}, include: { items: true } });
    const products = await tx.product.findMany({
      where: { id: { in: guest.items.map((i) => i.productId) } },
      select: { id: true, stockCount: true, inStock: true },
    });
    const stockById = new Map(products.map((p) => [p.id, p.inStock ? p.stockCount : 0]));
    const existingQty = new Map(userCart.items.map((i) => [i.productId, i.quantity]));

    let mergedItems = 0;
    for (const item of guest.items) {
      const stock = stockById.get(item.productId) ?? 0;
      const quantity = Math.min((existingQty.get(item.productId) ?? 0) + item.quantity, appConfig.maxQuantityPerItem, stock);
      if (quantity <= 0) continue;
      await tx.cartItem.upsert({
        where: { cartId_productId: { cartId: userCart.id, productId: item.productId } },
        create: { cartId: userCart.id, productId: item.productId, quantity },
        update: { quantity },
      });
      mergedItems++;
    }
    return { mergedItems };
  }, { maxWait: 5000, timeout: 20000 });
}

/** Removes ordered quantities from the user's cart (called after a successful payment). */
export async function removeOrderedItemsFromCart(
  tx: Prisma.TransactionClient,
  userId: string,
  items: { productId: string | null; quantity: number }[],
) {
  const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
  if (!cart) return;
  for (const item of items) {
    if (!item.productId) continue;
    await tx.cartItem.updateMany({
      where: { cartId: cart.id, productId: item.productId },
      data: { quantity: { decrement: item.quantity } },
    });
  }
  await tx.cartItem.deleteMany({ where: { cartId: cart.id, quantity: { lte: 0 } } });
}

export async function deleteExpiredGuestCarts(): Promise<number> {
  const res = await prisma.cart.deleteMany({ where: { guestId: { not: null }, expiresAt: { lt: new Date() } } });
  return res.count;
}
