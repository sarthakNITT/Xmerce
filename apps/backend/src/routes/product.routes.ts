import {
  handleSearchProducts,
  handleSearchSuggestions,
  handleGetProductDetails,
} from "../controllers/product.controller";

export async function handleProductRoutes(req: Request, pathname: string): Promise<Response | null> {
  // Search endpoint: /api/products/search?q=red+shoes&minPrice=20...
  if (pathname === "/api/products/search" && req.method === "GET") {
    return await handleSearchProducts(req);
  }

  // Typeahead autocomplete suggestions: /api/products/suggest?q=red
  if (pathname === "/api/products/suggest" && req.method === "GET") {
    return await handleSearchSuggestions(req);
  }

  // Product detail: /api/products/:slug
  if (pathname.startsWith("/api/products/") && req.method === "GET") {
    const slug = pathname.replace("/api/products/", "").trim();
    if (slug && !slug.includes("/")) {
      return await handleGetProductDetails(req, slug);
    }
  }

  return null;
}
