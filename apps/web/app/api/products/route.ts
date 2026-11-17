import { products } from "../../../data/products";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const brand = searchParams.get("brand")?.trim();
  const q = searchParams.get("q")?.trim().toLowerCase();
  const minPrice = Number(searchParams.get("minPrice") ?? 0);
  const maxPrice = Number(searchParams.get("maxPrice") ?? Number.MAX_SAFE_INTEGER);
  const limit = Number(searchParams.get("limit") ?? 20);
  const offset = Number(searchParams.get("offset") ?? 0);

  let filtered = products.filter((product) => {
    const matchesBrand = !brand || product.brand.toLowerCase() === brand.toLowerCase();
    const matchesSearch =
      !q ||
      product.name.toLowerCase().includes(q) ||
      product.brand.toLowerCase().includes(q) ||
      product.processor.toLowerCase().includes(q);
    const matchesMinPrice = product.price >= minPrice;
    const matchesMaxPrice = product.price <= maxPrice;

    return matchesBrand && matchesSearch && matchesMinPrice && matchesMaxPrice;
  });

  const total = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  return Response.json({
    products: page,
    total,
    limit,
    offset,
    filters: {
      brand,
      q,
      minPrice,
      maxPrice,
    },
  });
}
