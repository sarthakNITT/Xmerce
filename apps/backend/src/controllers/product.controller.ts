import { searchProducts, getSearchSuggestions, getProductBySlug } from "../services/product.service";

export async function handleSearchProducts(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const query = url.searchParams.get("q") || undefined;
  const category = url.searchParams.get("category") || undefined;
  const minPrice = url.searchParams.has("minPrice") ? Number(url.searchParams.get("minPrice")) : undefined;
  const maxPrice = url.searchParams.has("maxPrice") ? Number(url.searchParams.get("maxPrice")) : undefined;
  const brand = url.searchParams.get("brand") || undefined;
  const color = url.searchParams.get("color") || undefined;
  const inStock = url.searchParams.has("inStock") ? url.searchParams.get("inStock") === "true" : undefined;
  const minRating = url.searchParams.has("minRating") ? Number(url.searchParams.get("minRating")) : undefined;
  const sortBy = url.searchParams.get("sortBy") as any;
  const page = Number(url.searchParams.get("page")) || 1;
  const limit = Number(url.searchParams.get("limit")) || 20;

  try {
    const result = await searchProducts({
      query,
      category,
      minPrice,
      maxPrice,
      brand,
      color,
      inStock,
      minRating,
      sortBy,
      page,
      limit,
    });

    return Response.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("Product search error:", error);
    return Response.json({ error: "Failed to search products: " + error.message }, { status: 500 });
  }
}

export async function handleSearchSuggestions(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";

  try {
    const suggestions = await getSearchSuggestions(q);
    return Response.json({
      success: true,
      data: suggestions,
    });
  } catch (error: any) {
    return Response.json({ error: "Failed to fetch suggestions: " + error.message }, { status: 500 });
  }
}

export async function handleGetProductDetails(req: Request, slug: string): Promise<Response> {
  try {
    const product = await getProductBySlug(slug);
    if (!product) {
      return Response.json({ error: "Product not found" }, { status: 404 });
    }
    return Response.json({ success: true, data: product });
  } catch (error: any) {
    return Response.json({ error: "Failed to fetch product: " + error.message }, { status: 500 });
  }
}
