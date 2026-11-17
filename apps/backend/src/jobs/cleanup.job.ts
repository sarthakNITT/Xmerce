import { deleteExpiredGuestCarts } from "../services/cart.service";
import { expireStaleOrders } from "../services/order.service";

const INTERVAL_MS = 5 * 60 * 1000;

async function runCleanup() {
  try {
    const [orders, carts] = await Promise.all([expireStaleOrders(), deleteExpiredGuestCarts()]);
    if (orders || carts) {
      console.log(`[cleanup] expired ${orders} unpaid order(s), deleted ${carts} stale guest cart(s)`);
    }
  } catch (err) {
    console.error("[cleanup] failed:", err);
  }
}

/** Releases stock held by unpaid orders and removes abandoned guest carts. */
export function startCleanupJob() {
  void runCleanup();
  setInterval(runCleanup, INTERVAL_MS);
}
