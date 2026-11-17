import type { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { appConfig } from "../config/app";
import { cache } from "../lib/cache";

export interface SearchProductsParams {
  query?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
  color?: string;
  inStock?: boolean;
  minRating?: number;
  sortBy?: "price_asc" | "price_desc" | "rating_desc" | "newest";
  page?: number;
  limit?: number;
}

/**
 * The lean shape used on search result listings and stored in the cache.
 * id/slug are needed so the frontend can open the product page; everything
 * else (description, stock, brand...) comes from GET /api/products/:slug.
 */
export interface ProductCard {
  id: string;
  slug: string;
  title: string;
  price: number;
  thumbnail: string | null;
}

export interface SearchResult {
  data: ProductCard[];
  pagination: { total: number; page: number; limit: number; totalPages: number; hasMore: boolean };
}

const SEARCH_VERSION_KEY = "search:version";
const SORTS = new Set(["price_asc", "price_desc", "rating_desc", "newest"]);

/** Bumps the cache version so every cached listing is ignored from now on. */
export async function invalidateSearchCache() {
  await cache.incr(SEARCH_VERSION_KEY);
}

async function cacheKey(prefix: string, params: object): Promise<string> {
  const version = (await cache.getRaw(SEARCH_VERSION_KEY)) ?? "0";
  const normalized = JSON.stringify(params, Object.keys(params).sort());
  const hash = new Bun.CryptoHasher("sha1").update(normalized).digest("hex");
  return `${prefix}:v${version}:${hash}`;
}

function normalizeParams(params: SearchProductsParams) {
  const finite = (n: number | undefined) => (n !== undefined && Number.isFinite(n) ? n : undefined);
  return {
    query: params.query?.trim().toLowerCase().replace(/\s+/g, " ") || undefined,
    category: params.category?.trim().toLowerCase() || undefined,
    minPrice: finite(params.minPrice),
    maxPrice: finite(params.maxPrice),
    brand: params.brand?.trim() || undefined,
    color: params.color?.trim() || undefined,
    inStock: params.inStock,
    minRating: finite(params.minRating),
    sortBy: params.sortBy && SORTS.has(params.sortBy) ? params.sortBy : undefined,
    page: Math.max(Math.floor(Number(params.page)) || 1, 1),
    limit: Math.min(Math.max(Math.floor(Number(params.limit)) || 20, 1), 100),
  };
}

/** Search listing: served from cache when possible, otherwise from the DB and then cached. */
export async function searchProducts(rawParams: SearchProductsParams): Promise<SearchResult & { cached: boolean }> {
  const params = normalizeParams(rawParams);
  const key = await cacheKey("search", params);

  const hit = await cache.get<SearchResult>(key);
  if (hit) return { ...hit, cached: true };

  const result = await searchProductsFromDb(params);
  await cache.set(key, result, appConfig.searchCacheTtlSeconds);
  return { ...result, cached: false };
}

async function searchProductsFromDb(params: ReturnType<typeof normalizeParams>): Promise<SearchResult> {
  const { page, limit } = params;
  const skip = (page - 1) * limit;
  const where: Prisma.ProductWhereInput = {};

  // Multi-word matching: "red shoes" -> every word must match title, description, brand, color or tags.
  if (params.query) {
    where.AND = params.query.split(" ").map((token) => ({
      OR: [
        { title: { contains: token, mode: "insensitive" } },
        { description: { contains: token, mode: "insensitive" } },
        { brand: { contains: token, mode: "insensitive" } },
        { color: { contains: token, mode: "insensitive" } },
        { tags: { has: token } },
      ],
    }));
  }
  if (params.category) where.category = { slug: params.category };
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.price = { gte: params.minPrice, lte: params.maxPrice };
  }
  if (params.brand) where.brand = { equals: params.brand, mode: "insensitive" };
  if (params.color) where.color = { equals: params.color, mode: "insensitive" };
  if (params.inStock !== undefined) where.inStock = params.inStock;
  if (params.minRating !== undefined) where.rating = { gte: params.minRating };

  const orderBy: Prisma.ProductOrderByWithRelationInput =
    params.sortBy === "price_asc"
      ? { price: "asc" }
      : params.sortBy === "price_desc"
        ? { price: "desc" }
        : params.sortBy === "rating_desc"
          ? { rating: "desc" }
          : { createdAt: "desc" };

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: { id: true, slug: true, title: true, price: true, images: true },
      orderBy: [orderBy, { id: "asc" }],
      skip,
      take: limit,
    }),
  ]);

  return {
    data: rows.map((p) => ({ id: p.id, slug: p.slug, title: p.title, price: p.price, thumbnail: p.images[0] ?? null })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + rows.length < total,
    },
  };
}

/** Typeahead suggestions for the search bar (cached, titles only). */
export async function getSearchSuggestions(keyword: string) {
  const trimmed = keyword.trim().toLowerCase();
  if (!trimmed) return [];

  const key = await cacheKey("suggest", { q: trimmed });
  const hit = await cache.get<{ id: string; slug: string; title: string; price: number }[]>(key);
  if (hit) return hit;

  const suggestions = await prisma.product.findMany({
    where: {
      OR: [
        { title: { contains: trimmed, mode: "insensitive" } },
        { brand: { contains: trimmed, mode: "insensitive" } },
        { tags: { has: trimmed } },
      ],
    },
    select: { id: true, slug: true, title: true, price: true },
    orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
    take: 8,
  });
  await cache.set(key, suggestions, appConfig.searchCacheTtlSeconds);
  return suggestions;
}

/** Full product page data. Always read from the DB so price and stock are current. */
export async function getProductBySlug(slug: string) {
  const product = await prisma.product.findUnique({
    where: { slug },
    include: { category: { select: { id: true, name: true, slug: true } } },
  });
  if (!product) return null;
  return {
    ...product,
    inStock: product.inStock && product.stockCount > 0,
    maxOrderQuantity: Math.min(product.stockCount, appConfig.maxQuantityPerItem),
  };
}
