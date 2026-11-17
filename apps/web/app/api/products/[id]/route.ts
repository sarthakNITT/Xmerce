import { products } from "../../../../data/products";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const productId = Number(id);
  const product = products.find((item) => item.id === productId);

  if (!product) {
    return Response.json({ error: "Product not found" }, { status: 404 });
  }

  return Response.json(product);
}
