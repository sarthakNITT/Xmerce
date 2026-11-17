import { handleClerkWebhook } from "../controllers/webhook.controller";
import { getProfile } from "../controllers/auth.controller";

export async function handleAuthRoutes(req: Request, pathname: string): Promise<Response | null> {
  // Webhook endpoint for Clerk event synchronization
  if (pathname === "/api/auth/webhook" && req.method === "POST") {
    return await handleClerkWebhook(req);
  }

  // Protected profile route
  if (pathname === "/api/auth/me" && req.method === "GET") {
    return await getProfile(req);
  }

  return null;
}
