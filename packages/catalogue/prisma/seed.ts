/**
 * Seeds the product catalogue. Safe to run again: categories are upserted by
 * slug, products by id and variants by SKU. It only writes to the tables in
 * the "catalogue" schema.
 *
 *   bun run db:seed
 */
import { disconnect, getPrisma } from "../src/db";
import { SPEC_KEYS } from "../src/specs";
import { CATEGORIES, PRODUCTS, type SeedProduct } from "./seed-data";

/** Rules the assistant demo depends on. A broken rule stops the seed. */
export function validateSeed(products: SeedProduct[]): string[] {
  const problems: string[] = [];
  const categorySlugs = new Set(CATEGORIES.map((category) => category.slug));
  const skus = new Set<string>();
  const ids = new Set<string>();

  for (const product of products) {
    const where = `${product.id} (${product.name})`;
    if (ids.has(product.id)) problems.push(`${where}: duplicate product id`);
    ids.add(product.id);
    if (!categorySlugs.has(product.category)) {
      problems.push(`${where}: unknown category "${product.category}"`);
    }

    const specKeys = Object.keys(product.specs).sort().join(",");
    if (specKeys !== [...SPEC_KEYS].sort().join(",")) {
      problems.push(`${where}: specs must have exactly the standard keys`);
    }

    const base = product.variants[0];
    if (!base) {
      problems.push(`${where}: has no variants`);
    } else if (base.price !== product.basePrice) {
      problems.push(`${where}: base variant price must equal basePrice`);
    }

    for (const variant of product.variants) {
      if (skus.has(variant.sku)) problems.push(`${where}: duplicate SKU ${variant.sku}`);
      skus.add(variant.sku);
      if (!Number.isInteger(variant.price) || !Number.isInteger(variant.stock)) {
        problems.push(`${where}: ${variant.sku} price and stock must be whole numbers`);
      }
      // "Gaming laptop under 1 lakh" must find nothing.
      if (product.category === "gaming" && variant.price <= 100_000) {
        problems.push(`${where}: Gaming products must cost more than INR 1,00,000`);
      }
    }

    if (
      product.category !== "gaming" &&
      /gaming|rtx/i.test(`${product.name} ${product.description}`)
    ) {
      problems.push(`${where}: "gaming" and "RTX" are reserved for the Gaming category`);
    }
  }
  return problems;
}

async function main() {
  const problems = validateSeed(PRODUCTS);
  if (problems.length > 0) {
    throw new Error(`Seed data is invalid:\n- ${problems.join("\n- ")}`);
  }

  const prisma = getPrisma();

  // Parents first, so a child's parentId can be resolved.
  const categoryIds = new Map<string, string>();
  const ordered = [...CATEGORIES].sort(
    (a, b) => Number(Boolean(a.parent)) - Number(Boolean(b.parent)),
  );
  for (const category of ordered) {
    const parentId = category.parent ? categoryIds.get(category.parent) : null;
    const data = { name: category.name, slug: category.slug, parentId: parentId ?? null };
    const saved = await prisma.category.upsert({
      where: { slug: category.slug },
      update: data,
      create: data,
    });
    categoryIds.set(category.slug, saved.id);
  }

  let variantCount = 0;
  for (const product of PRODUCTS) {
    const categoryId = categoryIds.get(product.category);
    if (!categoryId) throw new Error(`No category for ${product.id}`);
    const images = Array.from(
      { length: product.imageCount },
      (_, i) => `/images/products/${product.id}-${i + 1}.jpg`,
    );
    const data = {
      categoryId,
      name: product.name,
      brand: product.brand,
      description: product.description,
      basePrice: product.basePrice,
      mrp: product.mrp,
      rating: product.rating,
      reviewCount: product.reviewCount,
      images,
      specs: { ...product.specs },
      active: true,
      popularity: product.popularity,
    };
    await prisma.$transaction([
      prisma.product.upsert({
        where: { id: product.id },
        update: data,
        create: { id: product.id, ...data },
      }),
      ...product.variants.map((variant) => {
        const variantData = {
          productId: product.id,
          processor: variant.processor ?? null,
          ramGb: variant.ramGb ?? null,
          storageGb: variant.storageGb ?? null,
          colour: variant.colour ?? null,
          price: variant.price,
          stock: variant.stock,
        };
        return prisma.productVariant.upsert({
          where: { sku: variant.sku },
          update: variantData,
          create: { sku: variant.sku, ...variantData },
        });
      }),
    ]);
    variantCount += product.variants.length;
  }

  console.log(
    `Seeded ${CATEGORIES.length} categories, ${PRODUCTS.length} products and ${variantCount} variants.`,
  );
}

if (import.meta.main) {
  try {
    await main();
  } finally {
    await disconnect();
  }
}
