import {
  getCandidates,
  getProduct as getCatalogueProduct,
  listBrands,
  listCategories,
  type Candidate,
  type ProductDetail,
} from "@repo/catalogue";

/**
 * The predefined tools. They are the only way product data is read: the model
 * never gets SQL, and every filter below runs in the database query.
 */

export interface SearchArgs {
  category?: string | null;
  maxPrice?: number | null;
  minRamGb?: number | null;
  minStorageGb?: number | null;
  maxWeightKg?: number | null;
  brand?: string | null;
  /** Carried for logging and future semantic ranking; not a filter. */
  useCase?: string | null;
  ignoreBudget?: boolean;
}

export const MAX_SEARCH_RESULTS = 10;

/** Everything the service needs from the catalogue; swapped for a fake in tests. */
export interface CatalogueTools {
  searchProducts(args: SearchArgs): Promise<Candidate[]>;
  getProduct(productId: string): Promise<ProductDetail | null>;
  listCategories(): Promise<string[]>;
  listBrands(): Promise<string[]>;
}

const defined = <T>(value: T | null | undefined): T | undefined => value ?? undefined;

/**
 * Active products matching the filters. For each product the cheapest
 * matching variant is returned, preferring one in stock; availability is
 * computed from that variant's live stock.
 */
export async function searchProducts(args: SearchArgs): Promise<Candidate[]> {
  return getCandidates({
    category: defined(args.category),
    maxPrice: defined(args.maxPrice),
    minRamGb: defined(args.minRamGb),
    minStorageGb: defined(args.minStorageGb),
    maxWeightKg: defined(args.maxWeightKg),
    brand: defined(args.brand),
    ignoreBudget: args.ignoreBudget ?? false,
    limit: MAX_SEARCH_RESULTS,
  });
}

/** One product with all its variants and their availability. */
export function getProduct(productId: string): Promise<ProductDetail | null> {
  return getCatalogueProduct(productId);
}

export const catalogueTools: CatalogueTools = {
  searchProducts,
  getProduct,
  listCategories,
  listBrands,
};

/**
 * The budget the shopper stated is the only budget a search may use. If a
 * model calls the tool with a different maxPrice, or tries to switch the
 * budget off itself, the arguments are corrected here before the query runs.
 */
export function enforceBudget(
  args: SearchArgs,
  budget: number | null,
  allowIgnoreBudget = false,
): SearchArgs {
  return {
    ...args,
    maxPrice: budget,
    ignoreBudget: allowIgnoreBudget ? (args.ignoreBudget ?? false) : false,
  };
}

/**
 * Tool definitions for a model that supports tool calling, with strict
 * JSON-schema parameters. `category` is an enum of the categories that exist
 * in the database right now.
 */
export function toolDefinitions(categories: string[]) {
  const nullable = (type: "number" | "string", description: string) => ({
    type: [type, "null"],
    description,
  });
  return [
    {
      type: "function",
      name: "searchProducts",
      description:
        "Search the NovaTech catalogue. Returns at most 10 real products with price, stock and specs. This is the only source of product data.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: [
          "category",
          "maxPrice",
          "minRamGb",
          "minStorageGb",
          "maxWeightKg",
          "brand",
          "useCase",
          "ignoreBudget",
        ],
        properties: {
          category: {
            type: ["string", "null"],
            enum: [...categories, null],
            description: "Product category.",
          },
          maxPrice: nullable("number", "Budget in whole rupees."),
          minRamGb: nullable("number", "Minimum RAM in GB."),
          minStorageGb: nullable("number", "Minimum storage in GB."),
          maxWeightKg: nullable("number", "Maximum weight in kg."),
          brand: nullable("string", "Brand name."),
          useCase: nullable("string", "What the shopper will use the product for."),
          ignoreBudget: {
            type: "boolean",
            description: "Drop the price limit to find the closest options above budget.",
          },
        },
      },
    },
    {
      type: "function",
      name: "getProduct",
      description: "Get one product with all its variants and their availability.",
      strict: true,
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["productId"],
        properties: {
          productId: { type: "string", description: 'Product id, for example "LAP-101".' },
        },
      },
    },
  ] as const;
}
