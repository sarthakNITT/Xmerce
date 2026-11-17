import { describe, expect, test } from "bun:test";
import { availabilityOf } from "../src/availability";
import { pickVariant } from "../src/catalogue";
import { SPEC_KEYS, makeSpecs } from "../src/specs";
import { validateSeed } from "../prisma/seed";
import { PRODUCTS } from "../prisma/seed-data";

describe("availabilityOf", () => {
  test("0 is out of stock, 1 to 5 is low stock, more is in stock", () => {
    expect(availabilityOf(0)).toBe("OUT_OF_STOCK");
    expect(availabilityOf(1)).toBe("LOW_STOCK");
    expect(availabilityOf(5)).toBe("LOW_STOCK");
    expect(availabilityOf(6)).toBe("IN_STOCK");
    expect(availabilityOf(-2)).toBe("OUT_OF_STOCK");
  });
});

describe("pickVariant", () => {
  test("the cheapest in-stock variant wins over a cheaper one that is sold out", () => {
    const picked = pickVariant([
      { sku: "b", price: 54990, stock: 22 },
      { sku: "a", price: 47990, stock: 0 },
    ]);
    expect(picked?.sku).toBe("b");
  });

  test("when nothing is in stock, the cheapest is returned", () => {
    const picked = pickVariant([
      { sku: "b", price: 60000, stock: 0 },
      { sku: "a", price: 50000, stock: 0 },
    ]);
    expect(picked?.sku).toBe("a");
  });

  test("no variants gives undefined", () => {
    expect(pickVariant([])).toBeUndefined();
  });
});

describe("specs", () => {
  test("makeSpecs always has every standard key, null when not given", () => {
    const specs = makeSpecs({ screenIn: 27 });
    expect(Object.keys(specs).sort()).toEqual([...SPEC_KEYS].sort());
    expect(specs.screenIn).toBe(27);
    expect(specs.ramGb).toBeNull();
  });
});

describe("seed data", () => {
  const variants = PRODUCTS.flatMap((p) =>
    p.variants.map((v) => ({ ...v, product: p })),
  );

  test("passes the rules the assistant demo depends on", () => {
    expect(validateSeed(PRODUCTS)).toEqual([]);
  });

  test("the validator catches a cheap Gaming product and a wrong base price", () => {
    const x17 = PRODUCTS.find((p) => p.id === "LAP-201")!;
    const cheap = { ...x17, variants: [{ ...x17.variants[0]!, price: 99990 }] };
    const problems = validateSeed([cheap]);
    expect(problems.some((p) => p.includes("more than INR 1,00,000"))).toBe(true);
    expect(problems.some((p) => p.includes("basePrice"))).toBe(true);
  });

  test("the eight required products have their exact names and prices", () => {
    const facts = (id: string) => {
      const p = PRODUCTS.find((x) => x.id === id);
      return [p?.name, p?.basePrice, p?.mrp];
    };
    expect(facts("LAP-101")).toEqual(["NovaBook Air 14", 64990, 74990]);
    expect(facts("LAP-102")).toEqual(["NovaBook Air 15", 69990, 76990]);
    expect(facts("LAP-103")).toEqual(["NovaBook Go 14", 54990, 59990]);
    expect(facts("LAP-104")).toEqual(["NovaBook Pro 15", 89990, 97990]);
    expect(facts("LAP-201")).toEqual(["Nova Gaming X17", 149990, 164990]);
    expect(facts("DSK-301")).toEqual(["NovaDesk Tower T5", 54990, 60990]);
    expect(facts("AIO-401")).toEqual(["NovaDesk One 24", 72990, 79990]);
    expect(facts("ADD-501")).toEqual(["NovaCare 3-Year Plan", 5999, null]);
  });

  test("LAP-101 stock adds up to 9 across its three variants", () => {
    const air14 = PRODUCTS.find((p) => p.id === "LAP-101")!;
    expect(air14.variants.map((v) => v.stock)).toEqual([6, 3, 0]);
  });

  test("at least 3 laptops at or under INR 70,000 with 16 GB, and a desktop under INR 60,000", () => {
    const laptops = new Set(
      variants
        .filter(
          (v) =>
            v.product.category === "laptops" &&
            v.price <= 70000 &&
            (v.ramGb ?? 0) >= 16,
        )
        .map((v) => v.product.id),
    );
    expect(laptops.size).toBeGreaterThanOrEqual(3);
    expect(
      variants.some((v) => v.product.category === "desktops" && v.price < 60000),
    ).toBe(true);
  });

  test("stock mix is roughly 70% in stock, 20% low, 10% out", () => {
    const share = (availability: string) =>
      variants.filter((v) => availabilityOf(v.stock) === availability).length /
      variants.length;
    expect(share("IN_STOCK")).toBeGreaterThan(0.6);
    expect(share("LOW_STOCK")).toBeGreaterThan(0.1);
    expect(share("OUT_OF_STOCK")).toBeGreaterThan(0.05);
    expect(share("OUT_OF_STOCK")).toBeLessThan(0.2);
  });
});
