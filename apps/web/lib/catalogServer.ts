import type { Product } from '../data/products';
import { toProduct, type BackendCard } from './productMapper';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/** Server-side (route handlers): load the catalogue from the backend. */
export async function fetchProductsServer(): Promise<Product[]> {
  const res = await fetch(`${API_URL}/api/products/search?limit=100&sortBy=rating_desc`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Backend returned ${res.status}`);
  const body = (await res.json()) as { data: BackendCard[] };
  return body.data.map(toProduct);
}
