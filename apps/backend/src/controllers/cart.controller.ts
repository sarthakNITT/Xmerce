import { appConfig } from "../config/app";
import { ok, readJson, requireInt, requireString, type RequestContext } from "../lib/http";
import { requireUserCart, resolveCartOwner, type CartOwnerResult } from "../middlewares/cart-owner.middleware";
import { addItem, clearCart, getCart, removeItem, setItemQuantity, type CartView } from "../services/cart.service";

function cartResponse(cart: CartView, r: CartOwnerResult) {
  return ok({ cart, guestId: r.guestId, mergedItems: r.mergedItems });
}

export async function getCartHandler(ctx: RequestContext) {
  const r = await resolveCartOwner(ctx, { forWrite: false });
  return cartResponse(await getCart(r.owner), r);
}

export async function addItemHandler(ctx: RequestContext) {
  const body = await readJson(ctx.req);
  const productId = requireString(body.productId, "productId", 64);
  const quantity = body.quantity === undefined ? 1 : requireInt(body.quantity, "quantity", 1, appConfig.maxQuantityPerItem);

  const r = await resolveCartOwner(ctx, { forWrite: true });
  return cartResponse(await addItem(r.owner!, productId, quantity), r);
}

export async function updateItemHandler(ctx: RequestContext) {
  const body = await readJson(ctx.req);
  const quantity = requireInt(body.quantity, "quantity", 0, appConfig.maxQuantityPerItem);

  const r = await resolveCartOwner(ctx, { forWrite: true });
  return cartResponse(await setItemQuantity(r.owner!, ctx.params.productId!, quantity), r);
}

export async function removeItemHandler(ctx: RequestContext) {
  const r = await resolveCartOwner(ctx, { forWrite: false });
  const cart = r.owner ? await removeItem(r.owner, ctx.params.productId!) : await getCart(null);
  return cartResponse(cart, r);
}

export async function clearCartHandler(ctx: RequestContext) {
  const r = await resolveCartOwner(ctx, { forWrite: false });
  const cart = r.owner ? await clearCart(r.owner) : await getCart(null);
  return cartResponse(cart, r);
}

/** Call right after sign-in: moves the guest cart (cookie) into the user's cart. */
export async function mergeCartHandler(ctx: RequestContext) {
  const { auth, mergedItems } = await requireUserCart(ctx);
  const cart = await getCart({ kind: "user", userId: auth.user.id });
  return ok({ cart, guestId: null, mergedItems });
}
