import { prisma } from "../config/db";
import { HttpError, type RequestContext } from "../lib/http";
import { requireAuth, type AuthContext } from "./auth.middleware";

// Emails listed here are promoted to ADMIN on their first admin request (bootstrap the first admin).
const bootstrapAdmins = (process.env.ADMIN_EMAILS || "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/** Signed-in Clerk user whose DB role is ADMIN; otherwise 401/403. */
export async function requireAdmin(ctx: RequestContext): Promise<AuthContext> {
  const auth = await requireAuth(ctx);
  if (auth.user.role === "ADMIN") return auth;

  if (bootstrapAdmins.includes(auth.user.email.toLowerCase())) {
    auth.user = await prisma.user.update({ where: { id: auth.user.id }, data: { role: "ADMIN" } });
    return auth;
  }
  throw new HttpError(403, "Admins only", "FORBIDDEN");
}
