# @repo/catalogue — NovaTech product catalogue

Product data for the AI shopping assistant (AI-A): categories, products and
their sellable variants, plus the query the assistant uses to fetch candidates.

## Where the data lives

Three tables in the Neon database, in their own Postgres schema `catalogue`:
`Category`, `Product` and `ProductVariant`. They are separate from the
backend's own `public."Product"` table and from the knowledge base in `rag`.
This package's Prisma schema only lists the `catalogue` schema, so it cannot
create, change or drop anything outside it.

Money is stored as whole rupees (integers). Availability is never stored; it
is computed from live stock with `availabilityOf`.

## Use

```ts
import { getCandidates, availabilityOf } from "@repo/catalogue";

const laptops = await getCandidates({
  category: "Laptops",
  maxPrice: 70000,
  minRamGb: 16,
});
// [{ productId: "LAP-101", productName: "NovaBook Air 14", sku, price, mrp,
//    rating, availability: "IN_STOCK", aboveBudget: false, variant, specs }, ...]

// Nothing fits the budget: fetch the closest options above it.
const closest = await getCandidates({
  category: "Gaming",
  maxPrice: 100000,
  ignoreBudget: true,
}); // Nova Gaming X17, aboveBudget: true
```

Filters: `category` (name or slug), `maxPrice`, `minRamGb`, `minStorageGb`,
`maxWeightKg`, `brand`, `ignoreBudget`, `limit`. All of them run in the
database query. For each product the cheapest matching variant is returned,
preferring one that is in stock. `variant` describes that configuration;
`specs` describes the product's base configuration.

It needs `DATABASE_URL` in `.env` at the repo root.

## Commands (run from this folder)

| Command | What it does |
| - | - |
| `bun run db:generate` | Builds the Prisma client into `src/generated` (also runs on `bun install`) |
| `bun run db:apply` | Applies new files in `prisma/migrations` to the database |
| `bun run db:seed` | Loads the 28 products; safe to run again |
| `bun run verify` | Checks the seeded data against the demo rules |
| `bun test` | Unit tests; no database needed |

## Changing the schema

`prisma migrate dev` and `prisma db pull` connect on port 5432, which is
blocked on the network this was built on. The runtime client avoids that by
using Prisma's Neon adapter (port 443), and migrations are applied by
`db:apply` instead:

1. Edit `prisma/schema.prisma`.
2. Generate the SQL for the change into a new folder under
   `prisma/migrations/` with `bunx prisma migrate diff ... --script`.
3. Read the SQL. `db:apply` refuses a file that drops a table, schema or
   column, or truncates.
4. `bun run db:apply`, then `bun run db:generate`.

Never run `prisma migrate reset` or `prisma db push --force-reset` against
this database: other tables live in it.

## Seed data

`prisma/seed-data.ts` holds 28 products. The first eight (LAP-101 to ADD-501)
are fixed by the demo scenarios. The seed stops with an error if a rule the
assistant relies on is broken, for example a Gaming product at or under
INR 1,00,000, a base variant whose price differs from `basePrice`, or the
words "gaming" or "RTX" outside the Gaming category.

Image paths such as `/images/products/LAP-101-1.jpg` are placeholders; the
image files do not exist yet.
