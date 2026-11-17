// Loads the NovaTech computer catalogue (packages/catalogue seed data) into the
// store's own Category/Product tables, keeping the catalogue ids (e.g. "LAP-101")
// so AI assistant recommendations point at real store products.
// Run: bun run db:seed:catalogue   (safe to re-run: upserts by id)
import { CATEGORIES, PRODUCTS } from "../../../packages/catalogue/prisma/seed-data";
import { prisma } from "../src/config/db";

async function main() {
  const categoryIds = new Map<string, string>();
  for (const c of CATEGORIES) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { name: c.name },
      create: { name: c.name, slug: c.slug },
    });
    categoryIds.set(c.slug, row.id);
  }

  for (const p of PRODUCTS) {
    const stockCount = p.variants.reduce((sum, v) => sum + v.stock, 0);
    const s = p.specs;
    const tags = [p.category, p.brand, s.processor, s.gpu, s.ramGb ? `${s.ramGb}gb` : null]
      .filter((t): t is string => !!t)
      .map((t) => t.toLowerCase());
    const data = {
      title: p.name,
      slug: p.id.toLowerCase(),
      description: p.description,
      price: p.basePrice,
      mrp: p.mrp,
      brand: p.brand,
      rating: p.rating,
      reviewCount: p.reviewCount,
      stockCount,
      inStock: stockCount > 0,
      images: [] as string[], // storefront draws device art until an admin adds real images
      tags,
      specs: { ...s },
      categoryId: categoryIds.get(p.category) ?? null,
    };
    await prisma.product.upsert({ where: { id: p.id }, update: data, create: { id: p.id, ...data } });
  }
  console.log(`✅ Synced ${CATEGORIES.length} categories and ${PRODUCTS.length} products into the store`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
