import { ok, type RequestContext } from "../lib/http";
import { requireAuth } from "../middlewares/auth.middleware";
import { getPurchasedProducts, getUserOverview } from "../services/user.service";

/** GET /api/users/me — profile from Clerk-synced DB record plus order/cart counts. */
export async function getMeHandler(ctx: RequestContext) {
  const { user } = await requireAuth(ctx);
  return ok(await getUserOverview(user.id));
}

/** GET /api/users/me/purchased-products — distinct products the user has paid for. */
export async function getPurchasedProductsHandler(ctx: RequestContext) {
  const { user } = await requireAuth(ctx);
  const limit = Math.min(Math.max(Number(ctx.url.searchParams.get("limit")) || 20, 1), 50);
  return ok({ data: await getPurchasedProducts(user.id, limit) });
}
