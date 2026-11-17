/**
 * Checks the seeded catalogue against the rules the assistant demo relies on.
 *
 *   bun run verify
 */
import { Pool } from "@neondatabase/serverless";
import { availabilityOf, disconnect, getCandidates, getPrisma } from "../src/index";

const prisma = getPrisma();
let failures = 0;
function check(label: string, ok: boolean, detail: string) {
  if (!ok) failures++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}\n      ${detail}`);
}
const inr = (n: number) => `INR ${n.toLocaleString("en-IN")}`;

// 1. Products per category, and total variants.
const categories = await prisma.category.findMany({
  include: { _count: { select: { products: true } } },
  orderBy: { name: "asc" },
});
console.log("1. Products per category");
for (const category of categories) {
  console.log(`      ${category.name}: ${category._count.products}`);
}
const [productTotal, variantTotal] = await Promise.all([
  prisma.product.count(),
  prisma.productVariant.count(),
]);
console.log(`      Total: ${productTotal} products, ${variantTotal} variants\n`);

// 2. Laptops at or under 70,000 with at least 16 GB.
const laptops = await getCandidates({ category: "Laptops", maxPrice: 70000, minRamGb: 16 });
check(
  "2. Laptops, maxPrice 70000, minRamGb 16: at least 3, all within budget",
  laptops.length >= 3 &&
    laptops.every((c) => c.price <= 70000 && (c.variant.ramGb ?? 0) >= 16),
  laptops
    .map((c) => `${c.productId} ${c.productName}, ${inr(c.price)}, ${c.variant.ramGb} GB, ${c.availability}`)
    .join("\n      "),
);

// 3. No gaming laptop under 1 lakh; the X17 appears once the budget is ignored.
const gaming = await getCandidates({ category: "Gaming", maxPrice: 100000 });
const gamingAny = await getCandidates({
  category: "Gaming",
  maxPrice: 100000,
  ignoreBudget: true,
});
check("3a. Gaming, maxPrice 100000: returns nothing", gaming.length === 0, `${gaming.length} results`);
check(
  "3b. Gaming with ignoreBudget: returns Nova Gaming X17, marked above budget",
  gamingAny.some((c) => c.productName === "Nova Gaming X17" && c.aboveBudget),
  gamingAny
    .map((c) => `${c.productId} ${c.productName}, ${inr(c.price)}, aboveBudget=${c.aboveBudget}`)
    .join("\n      "),
);

// 4. A desktop under 60,000.
const desktops = await getCandidates({ category: "Desktops", maxPrice: 60000 });
check(
  "4. Desktops, maxPrice 60000: includes DSK-301",
  desktops.some((c) => c.productId === "DSK-301"),
  desktops.map((c) => `${c.productId} ${c.productName}, ${inr(c.price)}`).join("\n      "),
);

// 5. Stock facts the demos rely on.
const air14 = await prisma.productVariant.aggregate({
  where: { productId: "LAP-101" },
  _sum: { stock: true },
});
check("5a. LAP-101 total stock is 9", air14._sum.stock === 9, `total stock ${air14._sum.stock}`);
const air15Base = await prisma.productVariant.findUnique({
  where: { sku: "LAP-102-U5-16-512-SLV" },
});
check(
  "5b. LAP-102 base variant shows LOW_STOCK",
  air15Base !== null && availabilityOf(air15Base.stock) === "LOW_STOCK",
  `stock ${air15Base?.stock} -> ${air15Base ? availabilityOf(air15Base.stock) : "missing"}`,
);
const go14Out = await prisma.productVariant.findUnique({
  where: { sku: "LAP-103-R5-8-512-GRY" },
});
check(
  "5c. LAP-103 8 GB variant shows OUT_OF_STOCK",
  go14Out !== null && availabilityOf(go14Out.stock) === "OUT_OF_STOCK",
  `stock ${go14Out?.stock}`,
);

// 6. Everything outside the catalogue schema, for comparison with before.
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const tables = await pool.query(
  `SELECT table_schema AS s, table_name AS n FROM information_schema.tables
   WHERE table_type = 'BASE TABLE'
     AND table_schema NOT IN ('pg_catalog', 'information_schema', 'catalogue')
   ORDER BY 1, 2`,
);
console.log("6. Row counts of tables outside the catalogue schema");
for (const { s, n } of tables.rows) {
  const result = await pool.query(`SELECT COUNT(*)::int AS c FROM "${s}"."${n}"`);
  console.log(`      ${s}.${n}: ${result.rows[0].c}`);
}
await pool.end();
await disconnect();

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
