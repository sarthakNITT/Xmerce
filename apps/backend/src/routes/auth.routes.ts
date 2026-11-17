import type { Router } from "../lib/router";
import { handleClerkWebhook } from "../controllers/webhook.controller";
import { getProfile } from "../controllers/auth.controller";

export function registerAuthRoutes(router: Router) {
  // Clerk -> DB user sync (user.created / user.updated / user.deleted)
  router.post("/api/auth/webhook", (ctx) => handleClerkWebhook(ctx.req));
  router.get("/api/auth/me", getProfile);
}
