import { ok, type RequestContext } from "../lib/http";
import { requireAuth } from "../middlewares/auth.middleware";

/** GET /api/auth/me — the signed-in user's DB record (created from Clerk if the webhook hasn't run yet). */
export async function getProfile(ctx: RequestContext) {
  const { user } = await requireAuth(ctx);
  return ok({ user });
}
