import { HttpError, ok, type RequestContext } from "../lib/http";
import { optionalAuth } from "../middlewares/auth.middleware";
import { getRecommendations } from "../services/recommendation.service";
import {
  getProductBySlug,
  getSearchSuggestions,
  searchProducts,
  type SearchProductsParams,
} from "../services/product.service";

const num = (v: string | null) => (v === null || v === "" ? undefined : Number(v));

/** GET /api/products/search — lean product cards for the results page (cached). */
export async function searchProductsHandler(ctx: RequestContext) {
  const sp = ctx.url.searchParams;
  const result = await searchProducts({
    query: sp.get("q") || undefined,
    category: sp.get("category") || undefined,
    minPrice: num(sp.get("minPrice")),
    maxPrice: num(sp.get("maxPrice")),
    brand: sp.get("brand") || undefined,
    color: sp.get("color") || undefined,
    inStock: sp.has("inStock") ? sp.get("inStock") === "true" : undefined,
    minRating: num(sp.get("minRating")),
    sortBy: (sp.get("sortBy") || undefined) as SearchProductsParams["sortBy"],
    page: num(sp.get("page")),
    limit: num(sp.get("limit")),
  });
  return ok(result);
}

/** GET /api/products/suggest?q= — typeahead for the search bar. */
export async function searchSuggestionsHandler(ctx: RequestContext) {
  const q = (ctx.url.searchParams.get("q") || "").slice(0, 100);
  return ok({ data: await getSearchSuggestions(q) });
}

/** GET /api/products/:slug — full product page. */
export async function getProductHandler(ctx: RequestContext) {
  const product = await getProductBySlug(ctx.params.slug!);
  if (!product) throw new HttpError(404, "Product not found", "PRODUCT_NOT_FOUND");
  return ok({ data: product });
}

/** GET /api/products/recommendations — top rated for guests, personalized from paid orders when signed in. */
export async function recommendationsHandler(ctx: RequestContext) {
  const auth = await optionalAuth(ctx).catch(() => null); // an expired token just means "guest" here
  const limit = Math.min(Math.max(Number(ctx.url.searchParams.get("limit")) || 8, 1), 24);
  return ok(await getRecommendations(auth?.user.id ?? null, limit));
}
