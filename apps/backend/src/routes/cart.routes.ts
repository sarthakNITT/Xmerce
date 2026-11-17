import type { Router } from "../lib/router";
import {
  addItemHandler,
  clearCartHandler,
  getCartHandler,
  mergeCartHandler,
  removeItemHandler,
  updateItemHandler,
} from "../controllers/cart.controller";

// Works for guests (cookie) and signed-in users (Bearer token).
export function registerCartRoutes(router: Router) {
  router.get("/api/cart", getCartHandler);
  router.delete("/api/cart", clearCartHandler);
  router.post("/api/cart/items", addItemHandler);
  router.patch("/api/cart/items/:productId", updateItemHandler);
  router.delete("/api/cart/items/:productId", removeItemHandler);
  router.post("/api/cart/merge", mergeCartHandler);
}
