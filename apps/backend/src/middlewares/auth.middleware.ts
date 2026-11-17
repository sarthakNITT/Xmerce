import { verifyToken } from "@clerk/backend";
import { clerkSecretKey } from "../config/clerk";
import { getUserByClerkId } from "../services/user.service";

export interface AuthenticatedContext {
  userId: string;
  user: any;
}

export async function requireAuth(req: Request): Promise<{ error?: Response; auth?: AuthenticatedContext }> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      error: Response.json({ error: "Unauthorized: Missing Bearer token" }, { status: 401 }),
    };
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    const verified = await verifyToken(token, {
      secretKey: clerkSecretKey,
    });

    if (!verified?.sub) {
      return {
        error: Response.json({ error: "Unauthorized: Invalid token subject" }, { status: 401 }),
      };
    }

    const dbUser = await getUserByClerkId(verified.sub);

    return {
      auth: {
        userId: verified.sub,
        user: dbUser,
      },
    };
  } catch (err: any) {
    return {
      error: Response.json({ error: "Unauthorized: " + (err.message || "Invalid or expired token") }, { status: 401 }),
    };
  }
}
