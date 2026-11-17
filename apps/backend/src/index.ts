const server = Bun.serve({
  port: process.env.PORT || 4000,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response("Backend API is running!");
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Backend server running on http://localhost:${server.port}`);
