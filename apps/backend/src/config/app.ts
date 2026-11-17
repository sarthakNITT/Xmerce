const isProduction = process.env.NODE_ENV === "production";

export const appConfig = {
  isProduction,
  port: Number(process.env.PORT) || 3001,

  // Comma-separated list of frontend origins allowed to call the API with cookies.
  corsOrigins: (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),

  // Guest cart identity
  guestCookieName: "xm_guest_id",
  guestCartTtlDays: 30,

  // Cart limits
  maxQuantityPerItem: 10,
  maxCartLines: 50,

  // Pricing
  freeShippingThreshold: 50,
  shippingFee: 4.99,
  taxRate: 0, // e.g. 0.18 for 18%

  // Unpaid orders give back their reserved stock after this many minutes
  pendingOrderTtlMinutes: 30,
  estimatedDeliveryDays: 5,

  // Search cache
  redisUrl: process.env.REDIS_URL || "",
  searchCacheTtlSeconds: 60,
};
