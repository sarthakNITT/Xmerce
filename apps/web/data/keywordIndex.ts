import { products, type Product } from "./products";

export type KeywordIndexMapping = {
  settings: {
    number_of_shards: number;
    number_of_replicas: number;
  };
  mappings: {
    properties: {
      id: { type: string };
      keyword: { type: string; analyzer?: string; fields?: Record<string, { type: string }> };
      normalizedKeyword: { type: string };
      productId: { type: string };
      category: { type: string };
      brand: { type: string };
      synonyms: { type: string };
      isActive: { type: string };
      createdAt: { type: string };
      updatedAt: { type: string };
    };
  };
};

export const keywordIndexMapping: KeywordIndexMapping = {
  settings: {
    number_of_shards: 1,
    number_of_replicas: 0,
  },
  mappings: {
    properties: {
      id: { type: "keyword" },
      keyword: {
        type: "text",
        analyzer: "standard",
        fields: {
          keyword: { type: "keyword" },
        },
      },
      normalizedKeyword: { type: "keyword" },
      productId: { type: "keyword" },
      category: { type: "keyword" },
      brand: { type: "keyword" },
      synonyms: { type: "text" },
      isActive: { type: "boolean" },
      createdAt: { type: "date" },
      updatedAt: { type: "date" },
    },
  },
};

export type KeywordDocument = {
  id: string;
  keyword: string;
  normalizedKeyword: string;
  productId: string;
  category: "Laptops";
  brand: string;
  synonyms: string[];
  isActive: boolean;
};

function normalizeKeyword(keyword: string): string {
  return keyword
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getProductKeywords(product: Product): string[] {
  return [
    product.name,
    product.model,
    product.brand,
    product.processor,
    product.cpu,
    `${product.ram} ${product.ramType} RAM`,
    `${product.rom} ${product.romType}`,
    product.gpu,
    `${product.displaySize} display`,
    `${product.resolutionWidth}x${product.resolutionHeight}`,
    product.os,
    `${product.brand} ${product.model}`,
  ];
}

export function createKeywordDocuments(catalog: Product[]): KeywordDocument[] {
  return catalog.flatMap((product) => {
    const seenKeywords = new Set<string>();

    return getProductKeywords(product)
      .map((keyword) => keyword.trim())
      .filter((keyword) => {
        const normalizedKeyword = normalizeKeyword(keyword);
        if (!normalizedKeyword || seenKeywords.has(normalizedKeyword)) {
          return false;
        }

        seenKeywords.add(normalizedKeyword);
        return true;
      })
      .map((keyword) => {
        const normalizedKeyword = normalizeKeyword(keyword);
        return {
          id: `${product.id}-${normalizedKeyword}`,
          keyword,
          normalizedKeyword,
          productId: String(product.id),
          category: "Laptops",
          brand: product.brand,
          synonyms: [],
          isActive: true,
        };
      });
  });
}

export const keywordDocuments = createKeywordDocuments(products);
