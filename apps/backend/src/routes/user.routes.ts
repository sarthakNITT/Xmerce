import type { Router } from "../lib/router";
import { getMeHandler, getPurchasedProductsHandler } from "../controllers/user.controller";

export function registerUserRoutes(router: Router) {
  router.get("/api/users/me", getMeHandler);
  router.get("/api/users/me/purchased-products", getPurchasedProductsHandler);
}
