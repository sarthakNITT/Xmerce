import { Prisma, type Role } from "@prisma/client";
import { prisma } from "../config/db";
import { HttpError } from "../lib/http";
import { invalidateSearchCache } from "./product.service";

export interface ProductInput {
  title?: string;
  slug?: string;
  description?: string;
  price?: number;
  brand?: string | null;
  color?: string | null;
  images?: string[];
  tags?: string[];
  stockCount?: number;
  rating?: number;
  categoryId?: string | null;
}

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);

function toDbData(input: ProductInput) {
  const data: Prisma.ProductUncheckedUpdateInput = { ...input };
  if (input.stockCount !== undefined) data.inStock = input.stockCount > 0;
  if (input.tags) data.tags = input.tags.map((t) => t.toLowerCase());
  return data;
}

function mapPrismaError(err: unknown): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") throw new HttpError(409, "A product with this slug already exists", "SLUG_TAKEN");
    if (err.code === "P2025") throw new HttpError(404, "Product not found", "PRODUCT_NOT_FOUND");
    if (err.code === "P2003") throw new HttpError(400, "categoryId does not exist", "INVALID_CATEGORY");
  }
  throw err;
}

export type AdminSort = "updated_desc" | "price_asc" | "price_desc" | "stock_asc" | "stock_desc" | "title_asc" | "newest";

const ADMIN_SORTS: Record<AdminSort, Prisma.ProductOrderByWithRelationInput> = {
  updated_desc: { updatedAt: "desc" },
  newest: { createdAt: "desc" },
  price_asc: { price: "asc" },
  price_desc: { price: "desc" },
  stock_asc: { stockCount: "asc" },
  stock_desc: { stockCount: "desc" },
  title_asc: { title: "asc" },
};

export async function adminListProducts(opts: {
  q?: string;
  lowStock?: number;
  category?: string;
  brand?: string;
  inStock?: boolean;
  sortBy?: string;
  page: number;
  limit: number;
}) {
  const where: Prisma.ProductWhereInput = {};
  if (opts.category) where.category = { slug: opts.category };
  if (opts.brand) where.brand = { equals: opts.brand, mode: "insensitive" };
  if (opts.inStock !== undefined) where.inStock = opts.inStock;
  if (opts.q) {
    where.OR = [
      { title: { contains: opts.q, mode: "insensitive" } },
      { slug: { contains: opts.q, mode: "insensitive" } },
      { brand: { contains: opts.q, mode: "insensitive" } },
    ];
  }
  if (opts.lowStock !== undefined) where.stockCount = { lte: opts.lowStock };
  const skip = (opts.page - 1) * opts.limit;
  const [total, data] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { category: { select: { id: true, name: true, slug: true } } },
      orderBy: [ADMIN_SORTS[(opts.sortBy as AdminSort) ?? "updated_desc"] ?? ADMIN_SORTS.updated_desc, { id: "asc" }],
      skip,
      take: opts.limit,
    }),
  ]);
  const brands = await prisma.product.findMany({ where: { brand: { not: null } }, distinct: ["brand"], select: { brand: true }, orderBy: { brand: "asc" } });
  return { data, brands: brands.map((b) => b.brand), pagination: { total, page: opts.page, limit: opts.limit, totalPages: Math.ceil(total / opts.limit), hasMore: skip + data.length < total } };
}

export async function adminGetProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id }, include: { category: true } });
  if (!product) throw new HttpError(404, "Product not found", "PRODUCT_NOT_FOUND");
  return product;
}

export async function adminCreateProduct(input: ProductInput & { title: string; description: string; price: number }) {
  try {
    const product = await prisma.product.create({
      data: {
        ...(toDbData(input) as Prisma.ProductUncheckedCreateInput),
        slug: input.slug ? slugify(input.slug) : slugify(input.title),
        inStock: (input.stockCount ?? 0) > 0,
      },
    });
    await invalidateSearchCache();
    return product;
  } catch (err) {
    mapPrismaError(err);
  }
}

export async function adminUpdateProduct(id: string, input: ProductInput) {
  try {
    const product = await prisma.product.update({
      where: { id },
      data: { ...toDbData(input), ...(input.slug ? { slug: slugify(input.slug) } : {}) },
    });
    await invalidateSearchCache();
    return product;
  } catch (err) {
    mapPrismaError(err);
  }
}

/** Set an exact stock level, or adjust it by a delta (e.g. +20 for a restock, -1 for damage). */
export async function adminAdjustStock(id: string, change: { set?: number; delta?: number }) {
  const product = await adminGetProduct(id);
  const next = change.set ?? product.stockCount + (change.delta ?? 0);
  if (next < 0) throw new HttpError(400, `Stock can't go below 0 (current ${product.stockCount})`, "VALIDATION_ERROR");
  return await adminUpdateProduct(id, { stockCount: next });
}

export async function adminDeleteProduct(id: string) {
  try {
    // Order history keeps its snapshot (OrderItem.productId is set to null); cart lines are removed.
    await prisma.product.delete({ where: { id } });
    await invalidateSearchCache();
  } catch (err) {
    mapPrismaError(err);
  }
}

export async function adminListCategories() {
  return await prisma.category.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { products: true } } } });
}

export async function adminCreateCategory(name: string, description?: string) {
  try {
    return await prisma.category.create({ data: { name, slug: slugify(name), description } });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new HttpError(409, "Category already exists", "CATEGORY_EXISTS");
    }
    throw err;
  }
}

export async function adminSetUserRole(userId: string, role: Role) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "User not found", "USER_NOT_FOUND");
  return await prisma.user.update({ where: { id: userId }, data: { role } });
}

export async function adminListUsers(page: number, limit: number) {
  const skip = (page - 1) * limit;
  const [total, data] = await Promise.all([
    prisma.user.count(),
    prisma.user.findMany({ orderBy: { createdAt: "desc" }, skip, take: limit, select: { id: true, email: true, username: true, firstName: true, lastName: true, role: true, createdAt: true } }),
  ]);
  return { data, pagination: { total, page, limit, totalPages: Math.ceil(total / limit), hasMore: skip + data.length < total } };
}
