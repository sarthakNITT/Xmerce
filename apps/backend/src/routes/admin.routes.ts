import type { Router } from "../lib/router";
import {
  adjustStockHandler,
  adminMeHandler,
  createCategoryHandler,
  createProductHandler,
  deleteProductHandler,
  getProductHandler,
  listCategoriesHandler,
  listProductsHandler,
  listUsersHandler,
  setUserRoleHandler,
  updateProductHandler,
} from "../controllers/admin.controller";

// Every route requires a Clerk token of a user whose role is ADMIN.
export function registerAdminRoutes(router: Router) {
  router.get("/api/admin/me", adminMeHandler);

  router.get("/api/admin/products", listProductsHandler);
  router.post("/api/admin/products", createProductHandler);
  router.get("/api/admin/products/:id", getProductHandler);
  router.patch("/api/admin/products/:id", updateProductHandler);
  router.patch("/api/admin/products/:id/stock", adjustStockHandler);
  router.delete("/api/admin/products/:id", deleteProductHandler);

  router.get("/api/admin/categories", listCategoriesHandler);
  router.post("/api/admin/categories", createCategoryHandler);

  router.get("/api/admin/users", listUsersHandler);
  router.patch("/api/admin/users/:id/role", setUserRoleHandler);
}
