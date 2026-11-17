import type { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import type { ProductCard } from "./product.service";

/**
 * Home page recommendations.
 *  - Guests, or users without paid orders: top rated in-stock products.
 *  - Signed-in users with paid orders: products similar to what they bought —
 *    same categories (weighted by how much they bought there), same brands,
 *    a similar price band and good ratings — excluding what they already own.
 *    Remaining slots are filled with top rated products.
 */

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  price: true,
  mrp: true,
  images: true,
  brand: true,
  rating: true,
  reviewCount: true,
  inStock: true,
  stockCount: true,
  specs: true,
  categoryId: true,
  category: { select: { name: true, slug: true } },
} satisfies Prisma.ProductSelect;

type CardRow = Prisma.ProductGetPayload<{ select: typeof cardSelect }>;

export interface Recommendation extends ProductCard {
  reason: string;
}

const toCard = (p: CardRow, reason: string): Recommendation => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  price: p.price,
  mrp: p.mrp,
  thumbnail: p.images[0] ?? null,
  brand: p.brand,
  rating: p.rating,
  reviewCount: p.reviewCount,
  inStock: p.inStock && p.stockCount > 0,
  category: p.category,
  specs: p.specs,
  reason,
});

async function topRated(limit: number, exclude: string[] = []): Promise<CardRow[]> {
  return prisma.product.findMany({
    where: { inStock: true, stockCount: { gt: 0 }, id: { notIn: exclude } },
    orderBy: [{ rating: "desc" }, { reviewCount: "desc" }],
    take: limit,
    select: cardSelect,
  });
}

export async function getRecommendations(userId: string | null, limit = 8) {
  const purchases = userId
    ? await prisma.orderItem.findMany({
        where: { order: { userId, status: "PAID" }, productId: { not: null } },
        select: {
          quantity: true,
          unitPrice: true,
          product: { select: { id: true, title: true, brand: true, categoryId: true, category: { select: { name: true } } } },
        },
        orderBy: { order: { paidAt: "desc" } },
        take: 50,
      })
    : [];

  const owned = purchases.flatMap((p) => (p.product ? [p.product] : []));
  if (owned.length === 0) {
    const rows = await topRated(limit);
    return {
      strategy: "top_rated" as const,
      basedOn: [] as string[],
      data: rows.map((r) => toCard(r, `Top rated · ${r.rating.toFixed(1)}★ from ${r.reviewCount.toLocaleString("en-IN")} reviews`)),
    };
  }

  // Taste profile from purchase history.
  const categoryWeight = new Map<string, number>();
  const brandWeight = new Map<string, number>();
  const categoryName = new Map<string, string>();
  let spend = 0;
  let units = 0;
  for (const p of purchases) {
    if (!p.product) continue;
    if (p.product.categoryId) {
      categoryWeight.set(p.product.categoryId, (categoryWeight.get(p.product.categoryId) ?? 0) + p.quantity);
      if (p.product.category) categoryName.set(p.product.categoryId, p.product.category.name);
    }
    if (p.product.brand) brandWeight.set(p.product.brand, (brandWeight.get(p.product.brand) ?? 0) + p.quantity);
    spend += p.unitPrice * p.quantity;
    units += p.quantity;
  }
  const avgPrice = spend / Math.max(units, 1);
  const maxCat = Math.max(...categoryWeight.values(), 1);
  const maxBrand = Math.max(...brandWeight.values(), 1);
  const ownedIds = [...new Set(owned.map((o) => o.id))];
  const lastByCategory = new Map<string, string>();
  for (const o of owned) if (o.categoryId && !lastByCategory.has(o.categoryId)) lastByCategory.set(o.categoryId, o.title);

  const candidates = await prisma.product.findMany({
    where: {
      inStock: true,
      stockCount: { gt: 0 },
      id: { notIn: ownedIds },
      OR: [{ categoryId: { in: [...categoryWeight.keys()] } }, { brand: { in: [...brandWeight.keys()] } }],
    },
    select: cardSelect,
  });

  const scored = candidates
    .map((c) => {
      const cat = c.categoryId ? (categoryWeight.get(c.categoryId) ?? 0) / maxCat : 0;
      const brand = c.brand ? (brandWeight.get(c.brand) ?? 0) / maxBrand : 0;
      const priceFit = Math.max(0, 1 - Math.abs(c.price - avgPrice) / Math.max(avgPrice, 1));
      const quality = c.rating / 5;
      const score = cat * 3 + brand * 1.5 + priceFit * 1.2 + quality;
      const reason =
        c.categoryId && lastByCategory.has(c.categoryId)
          ? `Because you bought ${lastByCategory.get(c.categoryId)}`
          : c.brand && brandWeight.has(c.brand)
            ? `More from ${c.brand}, a brand you bought`
            : `Similar to your past orders`;
      return { c, score, reason };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const picked = scored.map((s) => toCard(s.c, s.reason));
  if (picked.length < limit) {
    const fill = await topRated(limit - picked.length, [...ownedIds, ...picked.map((p) => p.id)]);
    picked.push(...fill.map((r) => toCard(r, `Top rated · ${r.rating.toFixed(1)}★`)));
  }

  return {
    strategy: "personalized" as const,
    basedOn: [...new Set(owned.map((o) => o.title))].slice(0, 3),
    data: picked,
  };
}
