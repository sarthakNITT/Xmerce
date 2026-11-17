import type { Router } from "../lib/router";
import {
  getProductHandler,
  recommendationsHandler,
  searchProductsHandler,
  searchSuggestionsHandler,
} from "../controllers/product.controller";

export function registerProductRoutes(router: Router) {
  // Static paths first so they aren't captured by :slug
  router.get("/api/products/search", searchProductsHandler);
  router.get("/api/products/suggest", searchSuggestionsHandler);
  router.get("/api/products/recommendations", recommendationsHandler);
  router.get("/api/products/:slug", getProductHandler);
}
