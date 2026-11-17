import { Meilisearch } from "meilisearch";
import type { Prisma } from "@prisma/client";
import { prisma } from "../config/db";

/**
 * Product search powered by Meilisearch (open-source search engine, apps/search).
 * Postgres stays the source of truth; this module mirrors products into the
 * "products" index and answers search-bar queries (typo-tolerant, ranked, faceted).
 * If Meilisearch is unreachable, callers fall back to the Postgres search.
 */

const host = process.env.MEILI_HOST || "http://127.0.0.1:7700";
const apiKey = process.env.MEILI_MASTER_KEY || undefined;
const client = new Meilisearch({ host, apiKey });
export const productIndex = client.index<ProductDoc>("products");

export interface ProductDoc {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  mrp: number | null;
  thumbnail: string | null;
  brand: string | null;
  color: string | null;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  tags: string[];
  category: { name: string; slug: string } | null;
  categorySlug: string | null;
  categoryName: string | null;
  specs: Prisma.JsonValue | null;
  /** Flattened spec values so "16gb", "ryzen" or "oled" match. */
  specText: string;
  createdAt: number;
}

const SETTINGS = {
  searchableAttributes: ["title", "brand", "categoryName", "tags", "specText", "description"],
  filterableAttributes: ["categorySlug", "brand", "price", "inStock", "rating"],
  sortableAttributes: ["price", "rating", "createdAt", "reviewCount"],
  rankingRules: ["words", "typo", "proximity", "attribute", "sort", "exactness", "rating:desc"],
  synonyms: {
    laptop: ["notebook"],
    notebook: ["laptop"],
    cpu: ["processor", "desktop", "tower"],
    processor: ["cpu"],
    pc: ["desktop", "computer"],
    computer: ["pc", "desktop"],
    screen: ["monitor", "display"],
    monitor: ["screen", "display"],
    gpu: ["graphics card"],
  },
};

const productSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  price: true,
  mrp: true,
  images: true,
  brand: true,
  color: true,
  rating: true,
  reviewCount: true,
  inStock: true,
  stockCount: true,
  tags: true,
  specs: true,
  createdAt: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect;

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function specText(specs: Prisma.JsonValue | null): string {
  if (!specs || typeof specs !== "object" || Array.isArray(specs)) return "";
  const parts: string[] = [];
  for (const [key, v] of Object.entries(specs)) {
    if (v === null || v === undefined) continue;
    if (key === "ramGb") parts.push(`${v}gb ram`, `${v} gb`);
    else if (key === "storageGb") parts.push(Number(v) >= 1024 ? `${Number(v) / 1024}tb` : `${v}gb`);
    else if (key === "refreshHz") parts.push(`${v}hz`);
    else if (key === "screenIn") parts.push(`${v} inch`);
    else if (typeof v === "string") parts.push(v);
  }
  return parts.join(" ");
}

export function toDoc(p: ProductRow): ProductDoc {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    description: p.description,
    price: p.price,
    mrp: p.mrp,
    thumbnail: p.images[0] ?? null,
    brand: p.brand,
    color: p.color,
    rating: p.rating,
    reviewCount: p.reviewCount,
    inStock: p.inStock && p.stockCount > 0,
    tags: p.tags,
    category: p.category,
    categorySlug: p.category?.slug ?? null,
    categoryName: p.category?.name ?? null,
    specs: p.specs,
    specText: specText(p.specs),
    createdAt: p.createdAt.getTime(),
  };
}

let available = false;
export const isSearchAvailable = () => available;

/** Applies index settings and loads every product from Postgres. Safe to call repeatedly. */
export async function reindexAllProducts(): Promise<number> {
  await client.health();
  await client.createIndex("products", { primaryKey: "id" }).waitTask().catch(() => {});
  await productIndex.updateSettings(SETTINGS).waitTask();
  const rows = await prisma.product.findMany({ select: productSelect });
  await productIndex.deleteAllDocuments().waitTask();
  if (rows.length) await productIndex.addDocuments(rows.map(toDoc), { primaryKey: "id" }).waitTask();
  available = true;
  return rows.length;
}

/** Re-sync specific products (after admin edits, orders changing stock, deletes). Never throws. */
export async function syncProducts(ids: string[]): Promise<void> {
  if (!available || ids.length === 0) return;
  try {
    const rows = await prisma.product.findMany({ where: { id: { in: ids } }, select: productSelect });
    const found = new Set(rows.map((r) => r.id));
    const missing = ids.filter((id) => !found.has(id));
    if (rows.length) await productIndex.addDocuments(rows.map(toDoc), { primaryKey: "id" }).waitTask();
    if (missing.length) await productIndex.deleteDocuments(missing).waitTask();
  } catch (err) {
    console.warn("[search] sync failed:", (err as Error).message);
  }
}

/** Connects at startup and retries in the background, so the backend can boot before Meilisearch. */
export function startSearchSync() {
  const attempt = async (n: number) => {
    try {
      const count = await reindexAllProducts();
      console.log(`🔎 Meilisearch ready at ${host} (${count} products indexed)`);
    } catch (err) {
      available = false;
      if (n === 0) console.warn(`[search] Meilisearch not reachable at ${host}; using Postgres search until it is.`);
      setTimeout(() => void attempt(n + 1), Math.min(30_000, 2_000 * (n + 1)));
    }
  };
  void attempt(0);
}
