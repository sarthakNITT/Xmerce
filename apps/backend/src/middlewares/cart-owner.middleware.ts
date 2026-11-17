import { appConfig } from "../config/app";
import { getCookie, HttpError, serializeCookie, type RequestContext } from "../lib/http";
import { mergeGuestCart, type CartOwner } from "../services/cart.service";
import { optionalAuth, type AuthContext } from "./auth.middleware";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GUEST_COOKIE_MAX_AGE = appConfig.guestCartTtlDays * 24 * 60 * 60;

/** Guest id comes from the HttpOnly cookie (browsers) or the X-Guest-Id header (other clients). */
function readGuestId(req: Request): string | null {
  const id = getCookie(req, appConfig.guestCookieName) ?? req.headers.get("x-guest-id") ?? "";
  return UUID_RE.test(id) ? id.toLowerCase() : null;
}

export interface CartOwnerResult {
  owner: CartOwner | null;
  auth: AuthContext | null;
  guestId: string | null;
  /** Number of guest cart lines merged into the user's cart on this request. */
  mergedItems: number;
}

/**
 * Works out whose cart a request is about.
 * - Signed in: the user's cart. If the request still carries a guest id (the guest
 *   just signed in), the guest cart is merged into the user's cart and the cookie cleared.
 * - Guest with an id: that guest cart.
 * - Guest without an id: no cart yet; one is created only when `forWrite` is true.
 */
export async function resolveCartOwner(ctx: RequestContext, opts: { forWrite: boolean }): Promise<CartOwnerResult> {
  const auth = await optionalAuth(ctx);
  const guestId = readGuestId(ctx.req);

  if (auth) {
    let mergedItems = 0;
    if (guestId) {
      mergedItems = (await mergeGuestCart(guestId, auth.user.id)).mergedItems;
      ctx.setCookies.push(serializeCookie(appConfig.guestCookieName, "", 0));
    }
    return { owner: { kind: "user", userId: auth.user.id }, auth, guestId: null, mergedItems };
  }

  if (guestId) {
    if (opts.forWrite) ctx.setCookies.push(serializeCookie(appConfig.guestCookieName, guestId, GUEST_COOKIE_MAX_AGE));
    return { owner: { kind: "guest", guestId }, auth: null, guestId, mergedItems: 0 };
  }

  if (opts.forWrite) {
    const newId = crypto.randomUUID();
    ctx.setCookies.push(serializeCookie(appConfig.guestCookieName, newId, GUEST_COOKIE_MAX_AGE));
    return { owner: { kind: "guest", guestId: newId }, auth: null, guestId: newId, mergedItems: 0 };
  }

  return { owner: null, auth: null, guestId: null, mergedItems: 0 };
}

/** Like resolveCartOwner but signed-in only (checkout, merge). Still merges any guest cart first. */
export async function requireUserCart(ctx: RequestContext) {
  const result = await resolveCartOwner(ctx, { forWrite: false });
  if (!result.auth) {
    throw new HttpError(401, "Please sign in to continue to checkout", "AUTH_REQUIRED");
  }
  return { auth: result.auth, mergedItems: result.mergedItems };
}
