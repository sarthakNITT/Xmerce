import { verifyToken } from "@clerk/backend";
import type { User } from "@prisma/client";
import { clerkSecretKey } from "../config/clerk";
import { HttpError, type RequestContext } from "../lib/http";
import { ensureUser } from "../services/user.service";

export interface AuthContext {
  clerkId: string;
  user: User;
}

function getBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}

async function authenticate(token: string): Promise<AuthContext> {
  let clerkId: string;
  try {
    const verified = await verifyToken(token, { secretKey: clerkSecretKey });
    if (!verified?.sub) throw new Error("Invalid token subject");
    clerkId = verified.sub;
  } catch (err) {
    throw new HttpError(401, "Unauthorized: " + ((err as Error).message || "Invalid or expired token"), "UNAUTHORIZED");
  }
  const user = await ensureUser(clerkId);
  return { clerkId, user };
}

/** Throws 401 unless a valid Clerk session token is sent as `Authorization: Bearer <token>`. */
export async function requireAuth(ctx: RequestContext): Promise<AuthContext> {
  const token = getBearerToken(ctx.req);
  if (!token) throw new HttpError(401, "Unauthorized: Missing Bearer token", "UNAUTHORIZED");
  return await authenticate(token);
}

/** Returns null for guests. A token that is sent but invalid is still a 401, so the client knows to refresh it. */
export async function optionalAuth(ctx: RequestContext): Promise<AuthContext | null> {
  const token = getBearerToken(ctx.req);
  if (!token) return null;
  return await authenticate(token);
}
