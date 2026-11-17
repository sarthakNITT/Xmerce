import { appConfig } from "./config/app";
import { cacheKind } from "./lib/cache";
import { applyCors, errorResponse, HttpError, preflight, type RequestContext } from "./lib/http";
import { Router } from "./lib/router";
import { startCleanupJob } from "./jobs/cleanup.job";
import { registerAuthRoutes } from "./routes/auth.routes";
import { registerCartRoutes } from "./routes/cart.routes";
import { registerOrderRoutes } from "./routes/order.routes";
import { registerProductRoutes } from "./routes/product.routes";
import { registerUserRoutes } from "./routes/user.routes";

const router = new Router();
registerAuthRoutes(router);
registerUserRoutes(router);
registerProductRoutes(router);
registerCartRoutes(router);
registerOrderRoutes(router);

const server = Bun.serve({
  port: appConfig.port,
  // Bun closes requests after 10s by default; checkout/merge transactions on a
  // remote DB over a slow link can take longer than that.
  idleTimeout: 60,
  async fetch(req) {
    if (req.method === "OPTIONS") return preflight(req);

    const url = new URL(req.url);
    if (url.pathname === "/health" || url.pathname === "/") {
      return applyCors(
        req,
        Response.json({ status: "ok", service: "xmerce-backend", cache: cacheKind, timestamp: new Date().toISOString() }),
      );
    }

    const match = router.match(req.method, url.pathname);
    const ctx: RequestContext = { req, url, params: match?.params ?? {}, setCookies: [] };

    let res: Response;
    try {
      res = match ? await match.handler(ctx) : errorResponse(404, "Route not found", "NOT_FOUND");
    } catch (err) {
      if (err instanceof HttpError) {
        res = errorResponse(err.status, err.message, err.code);
      } else {
        console.error(`[${req.method} ${url.pathname}]`, err);
        res = errorResponse(500, "Internal server error", "INTERNAL_ERROR");
      }
    }

    for (const cookie of ctx.setCookies) res.headers.append("Set-Cookie", cookie);
    return applyCors(req, res);
  },
});

startCleanupJob();
console.log(`🚀 Backend running at http://localhost:${server.port} (cache: ${cacheKind})`);
