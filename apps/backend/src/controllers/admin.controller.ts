import { HttpError, ok, optionalString, readJson, requireInt, requireString, type RequestContext } from "../lib/http";
import { requireAdmin } from "../middlewares/admin.middleware";
import {
  adminAdjustStock,
  adminCreateCategory,
  adminCreateProduct,
  adminDeleteProduct,
  adminGetProduct,
  adminListCategories,
  adminListProducts,
  adminListUsers,
  adminSetUserRole,
  adminUpdateProduct,
  type ProductInput,
} from "../services/admin.service";

const MAX_STOCK = 1_000_000;

function price(v: unknown): number {
  const n = typeof v === "string" ? Number(v) : v;
  if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 10_000_000) {
    throw new HttpError(400, '"price" must be a number >= 0', "VALIDATION_ERROR");
  }
  return Math.round(n * 100) / 100;
}

function stringList(v: unknown, field: string, max = 20): string[] {
  if (!Array.isArray(v) || v.length > max || v.some((x) => typeof x !== "string" || !x.trim() || x.length > 500)) {
    throw new HttpError(400, `"${field}" must be an array of up to ${max} non-empty strings`, "VALIDATION_ERROR");
  }
  return v.map((x: string) => x.trim());
}

function imageList(v: unknown): string[] {
  const list = stringList(v, "images", 10);
  for (const url of list) {
    if (!/^https?:\/\//i.test(url)) throw new HttpError(400, `Image "${url}" must be an http(s) URL`, "VALIDATION_ERROR");
  }
  return list;
}

const nullable = (v: unknown, field: string, max = 100) => (v === null ? null : optionalString(v, field, max));

/** Validates only the fields that are present, so the same parser serves create and partial update. */
function parseProduct(body: Record<string, unknown>): ProductInput {
  const input: ProductInput = {};
  if (body.title !== undefined) input.title = requireString(body.title, "title", 200);
  if (body.slug !== undefined) input.slug = requireString(body.slug, "slug", 120);
  if (body.description !== undefined) input.description = requireString(body.description, "description", 5000);
  if (body.price !== undefined) input.price = price(body.price);
  if (body.brand !== undefined) input.brand = nullable(body.brand, "brand");
  if (body.color !== undefined) input.color = nullable(body.color, "color");
  if (body.images !== undefined) input.images = imageList(body.images);
  if (body.tags !== undefined) input.tags = stringList(body.tags, "tags", 30);
  if (body.stockCount !== undefined) input.stockCount = requireInt(body.stockCount, "stockCount", 0, MAX_STOCK);
  if (body.rating !== undefined) {
    const r = Number(body.rating);
    if (!Number.isFinite(r) || r < 0 || r > 5) throw new HttpError(400, '"rating" must be between 0 and 5', "VALIDATION_ERROR");
    input.rating = r;
  }
  if (body.categoryId !== undefined) input.categoryId = body.categoryId === null ? null : requireString(body.categoryId, "categoryId", 64);
  return input;
}

const pageOf = (ctx: RequestContext, def = 20) => ({
  page: Math.max(Number(ctx.url.searchParams.get("page")) || 1, 1),
  limit: Math.min(Math.max(Number(ctx.url.searchParams.get("limit")) || def, 1), 100),
});

export async function adminMeHandler(ctx: RequestContext) {
  const { user } = await requireAdmin(ctx);
  return ok({ user });
}

export async function listProductsHandler(ctx: RequestContext) {
  await requireAdmin(ctx);
  const sp = ctx.url.searchParams;
  const lowStock = sp.has("lowStock") ? requireInt(sp.get("lowStock"), "lowStock", 0, MAX_STOCK) : undefined;
  return ok(
    await adminListProducts({
      q: sp.get("q") || undefined,
      lowStock,
      category: sp.get("category") || undefined,
      brand: sp.get("brand") || undefined,
      inStock: sp.has("inStock") ? sp.get("inStock") === "true" : undefined,
      sortBy: sp.get("sortBy") || undefined,
      ...pageOf(ctx),
    }),
  );
}

export async function getProductHandler(ctx: RequestContext) {
  await requireAdmin(ctx);
  return ok({ product: await adminGetProduct(ctx.params.id!) });
}

export async function createProductHandler(ctx: RequestContext) {
  await requireAdmin(ctx);
  const body = await readJson(ctx.req);
  for (const f of ["title", "description", "price"]) {
    if (body[f] === undefined) throw new HttpError(400, `"${f}" is required`, "VALIDATION_ERROR");
  }
  const input = parseProduct(body) as ProductInput & { title: string; description: string; price: number };
  return ok({ product: await adminCreateProduct(input) }, 201);
}

export async function updateProductHandler(ctx: RequestContext) {
  await requireAdmin(ctx);
  const input = parseProduct(await readJson(ctx.req));
  if (Object.keys(input).length === 0) throw new HttpError(400, "Nothing to update", "VALIDATION_ERROR");
  return ok({ product: await adminUpdateProduct(ctx.params.id!, input) });
}

/** Body: { stockCount: 50 } to set, or { delta: -3 } / { delta: 20 } to adjust. */
export async function adjustStockHandler(ctx: RequestContext) {
  await requireAdmin(ctx);
  const body = await readJson(ctx.req);
  if (body.stockCount !== undefined) {
    return ok({ product: await adminAdjustStock(ctx.params.id!, { set: requireInt(body.stockCount, "stockCount", 0, MAX_STOCK) }) });
  }
  if (body.delta !== undefined) {
    return ok({ product: await adminAdjustStock(ctx.params.id!, { delta: requireInt(body.delta, "delta", -MAX_STOCK, MAX_STOCK) }) });
  }
  throw new HttpError(400, 'Send "stockCount" or "delta"', "VALIDATION_ERROR");
}

export async function deleteProductHandler(ctx: RequestContext) {
  await requireAdmin(ctx);
  await adminDeleteProduct(ctx.params.id!);
  return ok({ deleted: true });
}

export async function listCategoriesHandler(ctx: RequestContext) {
  await requireAdmin(ctx);
  return ok({ data: await adminListCategories() });
}

export async function createCategoryHandler(ctx: RequestContext) {
  await requireAdmin(ctx);
  const body = await readJson(ctx.req);
  const category = await adminCreateCategory(requireString(body.name, "name", 100), optionalString(body.description, "description", 500));
  return ok({ category }, 201);
}

export async function listUsersHandler(ctx: RequestContext) {
  await requireAdmin(ctx);
  const { page, limit } = pageOf(ctx);
  return ok(await adminListUsers(page, limit));
}

export async function setUserRoleHandler(ctx: RequestContext) {
  const { user: me } = await requireAdmin(ctx);
  const body = await readJson(ctx.req);
  const role = String(body.role ?? "").toUpperCase();
  if (role !== "USER" && role !== "ADMIN") throw new HttpError(400, '"role" must be USER or ADMIN', "VALIDATION_ERROR");
  if (ctx.params.id === me.id && role === "USER") throw new HttpError(400, "You can't remove your own admin role", "VALIDATION_ERROR");
  return ok({ user: await adminSetUserRole(ctx.params.id!, role) });
}
