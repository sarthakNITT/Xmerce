import type { Router } from "../lib/router";
import { getMeHandler, getPurchasedProductsHandler, updateMeHandler } from "../controllers/user.controller";

export function registerUserRoutes(router: Router) {
  router.get("/api/users/me", getMeHandler);
  router.patch("/api/users/me", updateMeHandler);
  router.get("/api/users/me/purchased-products", getPurchasedProductsHandler);
}
