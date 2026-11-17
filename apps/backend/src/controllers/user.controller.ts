import { ok, optionalString, readJson, type RequestContext } from "../lib/http";
import { prisma } from "../config/db";
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

/** PATCH /api/users/me — update the editable profile fields (name). Email/identity stay managed by Clerk. */
export async function updateMeHandler(ctx: RequestContext) {
  const { user } = await requireAuth(ctx);
  const body = await readJson(ctx.req);
  const data: { firstName?: string | null; lastName?: string | null } = {};
  if (body.firstName !== undefined) data.firstName = optionalString(body.firstName, "firstName", 60) ?? null;
  if (body.lastName !== undefined) data.lastName = optionalString(body.lastName, "lastName", 60) ?? null;
  const updated = await prisma.user.update({ where: { id: user.id }, data });
  return ok({ user: updated });
}
