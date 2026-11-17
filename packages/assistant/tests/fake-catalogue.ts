import { availabilityOf, pickVariant, type Candidate } from "@repo/catalogue";
import { CATEGORIES, PRODUCTS } from "../../catalogue/prisma/seed-data";
import { extractByRules, rankByRules } from "../src/rules";
import type { AssistantLlm } from "../src/llm";
import type { AssistantDeps } from "../src/service";
import type { CatalogueTools, SearchArgs } from "../src/tools";
import type { InteractionLog } from "../src/log";

const categoryName = (slug: string) =>
  CATEGORIES.find((category) => category.slug === slug)?.name ?? slug;

/** The seed catalogue, searched in memory with the same rules as the database query. */
export function searchSeed(args: SearchArgs): Candidate[] {
  const results: Candidate[] = [];
  for (const product of PRODUCTS) {
    const category = categoryName(product.category);
    if (args.category && category.toLowerCase() !== args.category.toLowerCase()) continue;
    if (args.brand && product.brand.toLowerCase() !== args.brand.toLowerCase()) continue;
    if (
      args.maxWeightKg != null &&
      (product.specs.weightKg === null || product.specs.weightKg > args.maxWeightKg)
    ) {
      continue;
    }
    const matching = product.variants.filter(
      (variant) =>
        (args.ignoreBudget || args.maxPrice == null || variant.price <= args.maxPrice) &&
        (args.minRamGb == null || (variant.ramGb ?? 0) >= args.minRamGb) &&
        (args.minStorageGb == null || (variant.storageGb ?? 0) >= args.minStorageGb),
    );
    const variant = pickVariant(matching);
    if (!variant) continue;
    results.push({
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      category,
      sku: variant.sku,
      price: variant.price,
      mrp: product.mrp,
      rating: product.rating,
      stock: variant.stock,
      availability: availabilityOf(variant.stock),
      aboveBudget: args.maxPrice != null && variant.price > args.maxPrice,
      variant: {
        processor: variant.processor ?? null,
        ramGb: variant.ramGb ?? null,
        storageGb: variant.storageGb ?? null,
        colour: variant.colour ?? null,
      },
      specs: product.specs,
    });
  }
  return results.sort((a, b) => a.price - b.price).slice(0, 10);
}

export const CATEGORY_NAMES = CATEGORIES.map((category) => category.name);
export const BRANDS = [...new Set(PRODUCTS.map((product) => product.brand))];

export function fakeTools(): CatalogueTools & { searches: SearchArgs[] } {
  const searches: SearchArgs[] = [];
  return {
    searches,
    async searchProducts(args) {
      searches.push(args);
      return searchSeed(args);
    },
    async getProduct() {
      return null;
    },
    async listCategories() {
      return CATEGORY_NAMES;
    },
    async listBrands() {
      return BRANDS;
    },
  };
}

/** A well-behaved model: understands the message and ranks sensibly. */
export function goodLlm(): AssistantLlm & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    async extract(message, categories) {
      seen.push(message);
      const e = extractByRules(message, categories, BRANDS);
      return { category: e.category, budget: null, useCase: e.useCase, priorities: e.priorities };
    },
    async rank(request, candidates) {
      return rankByRules(candidates, request.priorities);
    },
  };
}

export function deps(overrides: Partial<AssistantDeps> = {}): AssistantDeps & {
  logs: InteractionLog[];
} {
  const logs: InteractionLog[] = [];
  return {
    tools: fakeTools(),
    llm: goodLlm(),
    aiEnabled: true,
    timeoutMs: 9000,
    log: (entry) => {
      logs.push(entry);
    },
    logs,
    ...overrides,
  };
}
