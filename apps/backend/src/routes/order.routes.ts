import type { Router } from "../lib/router";
import {
  cancelOrderHandler,
  checkoutSummaryHandler,
  getOrderHandler,
  listOrdersHandler,
  payOrderHandler,
  placeOrderHandler,
} from "../controllers/order.controller";

// All signed-in only.
export function registerOrderRoutes(router: Router) {
  router.get("/api/checkout", checkoutSummaryHandler);
  router.post("/api/orders", placeOrderHandler);
  router.get("/api/orders", listOrdersHandler);
  router.get("/api/orders/:id", getOrderHandler);
  router.post("/api/orders/:id/pay", payOrderHandler);
  router.post("/api/orders/:id/cancel", cancelOrderHandler);
}
