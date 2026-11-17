import { prisma } from "../config/db";

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

export async function searchProducts(params: SearchProductsParams) {
  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
  const skip = (page - 1) * limit;

  const whereClause: any = {};

  // Amazon-like Multi-word token matching (e.g., "red shoes" -> matches both "red" and "shoes")
  if (params.query && params.query.trim()) {
    const rawTokens = params.query.trim().split(/\s+/).filter(Boolean);

    // Each token must match either title, description, brand, color, or tags
    whereClause.AND = rawTokens.map((token) => ({
      OR: [
        { title: { contains: token, mode: "insensitive" } },
        { description: { contains: token, mode: "insensitive" } },
        { brand: { contains: token, mode: "insensitive" } },
        { color: { contains: token, mode: "insensitive" } },
        { tags: { has: token.toLowerCase() } },
      ],
    }));
  }

  // Category filter
  if (params.category) {
    whereClause.category = {
      slug: { equals: params.category.toLowerCase() },
    };
  }

  // Price Range
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    whereClause.price = {};
    if (params.minPrice !== undefined) whereClause.price.gte = Number(params.minPrice);
    if (params.maxPrice !== undefined) whereClause.price.lte = Number(params.maxPrice);
  }

  // Brand filter
  if (params.brand) {
    whereClause.brand = { equals: params.brand, mode: "insensitive" };
  }

  // Color filter
  if (params.color) {
    whereClause.color = { equals: params.color, mode: "insensitive" };
  }

  // Stock filter
  if (params.inStock !== undefined) {
    whereClause.inStock = params.inStock;
  }

  // Rating filter
  if (params.minRating !== undefined) {
    whereClause.rating = { gte: Number(params.minRating) };
  }

  // Sorting
  let orderBy: any = { createdAt: "desc" };
  if (params.sortBy === "price_asc") orderBy = { price: "asc" };
  if (params.sortBy === "price_desc") orderBy = { price: "desc" };
  if (params.sortBy === "rating_desc") orderBy = { rating: "desc" };
  if (params.sortBy === "newest") orderBy = { createdAt: "desc" };

  const [total, products] = await Promise.all([
    prisma.product.count({ where: whereClause }),
    prisma.product.findMany({
      where: whereClause,
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
      },
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  return {
    data: products,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: skip + products.length < total,
    },
  };
}

export async function getSearchSuggestions(keyword: string) {
  if (!keyword || !keyword.trim()) return [];

  const trimmed = keyword.trim();
  const suggestions = await prisma.product.findMany({
    where: {
      OR: [
        { title: { contains: trimmed, mode: "insensitive" } },
        { brand: { contains: trimmed, mode: "insensitive" } },
        { tags: { has: trimmed.toLowerCase() } },
      ],
    },
    select: {
      id: true,
      title: true,
      slug: true,
      brand: true,
      price: true,
    },
    take: 8,
  });

  return suggestions;
}

export async function getProductBySlug(slug: string) {
  return await prisma.product.findUnique({
    where: { slug },
    include: { category: true },
  });
}
