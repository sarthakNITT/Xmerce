import { handleAuthRoutes } from "./routes/auth.routes";
import { handleProductRoutes } from "./routes/product.routes";

const PORT = Number(process.env.PORT) || 4000;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, svix-id, svix-timestamp, svix-signature",
        },
      });
    }

    // Health check
    if (url.pathname === "/health" || url.pathname === "/") {
      return Response.json({
        status: "ok",
        service: "xmerce-backend",
        timestamp: new Date().toISOString(),
      });
    }

    // Auth & Webhook routes
    const authResponse = await handleAuthRoutes(req, url.pathname);
    if (authResponse) {
      authResponse.headers.set("Access-Control-Allow-Origin", "*");
      return authResponse;
    }

    // Product & Search routes
    const productResponse = await handleProductRoutes(req, url.pathname);
    if (productResponse) {
      productResponse.headers.set("Access-Control-Allow-Origin", "*");
      return productResponse;
    }

    return Response.json({ error: "Route not found" }, { status: 404 });
  },
});

console.log(`🚀 Backend running at http://localhost:${server.port}`);
