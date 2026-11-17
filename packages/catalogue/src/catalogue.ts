import { availabilityOf, type Availability } from "./availability";
import { getPrisma } from "./db";
import type { Prisma } from "./generated/prisma/client";
import type { ProductSpecs } from "./specs";

export interface CandidateFilters {
  /** Category name or slug, for example "Laptops" or "all-in-one". */
  category?: string;
  /** Budget in whole rupees. */
  maxPrice?: number;
  minRamGb?: number;
  minStorageGb?: number;
  maxWeightKg?: number;
  brand?: string;
  /**
   * Drop the price limit, to fetch the closest above-budget options when
   * nothing fits. Results then come cheapest first and each one says whether
   * it is above `maxPrice`.
   */
  ignoreBudget?: boolean;
  limit?: number;
}

export interface Candidate {
  productId: string;
  productName: string;
  brand: string;
  category: string;
  /** The variant chosen for this product, and its price in whole rupees. */
  sku: string;
  price: number;
  mrp: number | null;
  rating: number;
  /** Live stock of the chosen variant. */
  stock: number;
  /** Computed from `stock`, never stored. */
  availability: Availability;
  /** True when a budget was given and this price is over it. */
  aboveBudget: boolean;
  /** Configuration of the chosen variant; may differ from the base `specs`. */
  variant: {
    processor: string | null;
    ramGb: number | null;
    storageGb: number | null;
    colour: string | null;
  };
  /** Specs of the product's base configuration. */
  specs: ProductSpecs;
}

interface VariantLike {
  price: number;
  stock: number;
}

/**
 * From a product's matching variants, the cheapest one that is in stock; if
 * none is in stock, the cheapest.
 */
export function pickVariant<V extends VariantLike>(variants: V[]): V | undefined {
  const byPrice = [...variants].sort((a, b) => a.price - b.price);
  return byPrice.find((variant) => variant.stock > 0) ?? byPrice[0];
}

const AVAILABILITY_ORDER: Record<Availability, number> = {
  IN_STOCK: 0,
  LOW_STOCK: 1,
  OUT_OF_STOCK: 2,
};

/**
 * Catalogue candidates for the AI shopping assistant.
 *
 * Category, brand, price, RAM, storage and weight are all applied in the
 * database query. The model only ever ranks what this returns, so it cannot
 * recommend a product that breaks the budget or does not exist.
 */
export async function getCandidates(
  filters: CandidateFilters = {},
): Promise<Candidate[]> {
  const { category, maxPrice, minRamGb, minStorageGb, maxWeightKg, brand } = filters;
  const applyBudget = maxPrice !== undefined && !filters.ignoreBudget;

  const variantWhere: Prisma.ProductVariantWhereInput = {
    ...(applyBudget ? { price: { lte: maxPrice } } : {}),
    ...(minRamGb !== undefined ? { ramGb: { gte: minRamGb } } : {}),
    ...(minStorageGb !== undefined ? { storageGb: { gte: minStorageGb } } : {}),
  };

  const products = await getPrisma().product.findMany({
    where: {
      active: true,
      ...(category
        ? {
            category: {
              OR: [
                { name: { equals: category, mode: "insensitive" } },
                { slug: { equals: category.toLowerCase() } },
              ],
            },
          }
        : {}),
      ...(brand ? { brand: { equals: brand, mode: "insensitive" } } : {}),
      ...(maxWeightKg !== undefined
        ? { specs: { path: ["weightKg"], lte: maxWeightKg } }
        : {}),
      variants: { some: variantWhere },
    },
    include: {
      category: { select: { name: true } },
      variants: { where: variantWhere },
    },
  });

  const candidates = products.flatMap((product) => {
    const variant = pickVariant(product.variants);
    if (!variant) return [];
    const candidate: Candidate & { popularity: number } = {
      productId: product.id,
      productName: product.name,
      brand: product.brand,
      category: product.category.name,
      sku: variant.sku,
      price: variant.price,
      mrp: product.mrp,
      rating: Number(product.rating),
      stock: variant.stock,
      availability: availabilityOf(variant.stock),
      aboveBudget: maxPrice !== undefined && variant.price > maxPrice,
      variant: {
        processor: variant.processor,
        ramGb: variant.ramGb,
        storageGb: variant.storageGb,
        colour: variant.colour,
      },
      specs: product.specs as unknown as ProductSpecs,
      popularity: product.popularity,
    };
    return [candidate];
  });

  candidates.sort((a, b) =>
    filters.ignoreBudget
      ? // Closest to the budget first.
        a.price - b.price
      : AVAILABILITY_ORDER[a.availability] - AVAILABILITY_ORDER[b.availability] ||
        b.popularity - a.popularity ||
        a.price - b.price,
  );

  return candidates
    .slice(0, filters.limit ?? candidates.length)
    .map(({ popularity: _popularity, ...candidate }) => candidate);
}

export interface ProductDetail {
  productId: string;
  productName: string;
  brand: string;
  category: string;
  description: string;
  basePrice: number;
  mrp: number | null;
  rating: number;
  reviewCount: number;
  images: string[];
  specs: ProductSpecs;
  variants: {
    sku: string;
    processor: string | null;
    ramGb: number | null;
    storageGb: number | null;
    colour: string | null;
    price: number;
    stock: number;
    availability: Availability;
  }[];
}

/** One active product with all its variants, cheapest first. */
export async function getProduct(productId: string): Promise<ProductDetail | null> {
  const product = await getPrisma().product.findFirst({
    where: { id: productId, active: true },
    include: {
      category: { select: { name: true } },
      variants: { orderBy: { price: "asc" } },
    },
  });
  if (!product) return null;
  return {
    productId: product.id,
    productName: product.name,
    brand: product.brand,
    category: product.category.name,
    description: product.description,
    basePrice: product.basePrice,
    mrp: product.mrp,
    rating: Number(product.rating),
    reviewCount: product.reviewCount,
    images: product.images,
    specs: product.specs as unknown as ProductSpecs,
    variants: product.variants.map((variant) => ({
      sku: variant.sku,
      processor: variant.processor,
      ramGb: variant.ramGb,
      storageGb: variant.storageGb,
      colour: variant.colour,
      price: variant.price,
      stock: variant.stock,
      availability: availabilityOf(variant.stock),
    })),
  };
}

/** Names of the categories that exist, for example "Laptops". */
export async function listCategories(): Promise<string[]> {
  const categories = await getPrisma().category.findMany({
    select: { name: true },
    orderBy: { name: "asc" },
  });
  return categories.map((category) => category.name);
}

/** Brands that have at least one active product. */
export async function listBrands(): Promise<string[]> {
  const brands = await getPrisma().product.findMany({
    where: { active: true },
    distinct: ["brand"],
    select: { brand: true },
    orderBy: { brand: "asc" },
  });
  return brands.map((row) => row.brand);
}
