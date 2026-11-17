import type { Product } from '../data/products';

/** Shape of a product card returned by the backend's GET /api/products/search. */
export interface BackendCard {
  id: string;
  slug: string;
  title: string;
  price: number;
  mrp: number | null;
  thumbnail: string | null;
  brand: string | null;
  rating: number;
  reviewCount: number;
  inStock: boolean;
  category: { name: string; slug: string } | null;
  specs: Record<string, unknown> | null;
}

const CATEGORY_BY_SLUG: Record<string, Product['category']> = {
  laptops: 'Laptops',
  gaming: 'Gaming',
  desktops: 'Desktops',
  'all-in-one': 'All-in-One',
  monitors: 'Monitors',
  accessories: 'Accessories',
  'add-ons': 'Accessories',
  components: 'Accessories',
};

const str = (v: unknown) => (typeof v === 'string' && v ? v : null);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

function storageLabel(gb: number | null, type: string | null) {
  if (!gb) return null;
  const size = gb >= 1024 ? `${gb / 1024} TB` : `${gb} GB`;
  return type ? `${size} ${type}` : size;
}

export function toProduct(card: BackendCard): Product {
  const s = card.specs ?? {};
  const ram = num(s.ramGb);
  const storage = storageLabel(num(s.storageGb), str(s.storageType));
  const screen = str(s.screen);
  const weightKg = num(s.weightKg);
  const battery = num(s.batteryHrs);
  const specLine = [ram ? `${ram} GB` : null, storage, screen, str(s.gpu), weightKg ? `${weightKg} kg` : null]
    .filter(Boolean)
    .join(' · ');
  return {
    id: card.id,
    name: card.title,
    category: CATEGORY_BY_SLUG[card.category?.slug ?? ''] ?? 'Accessories',
    brand: card.brand ?? '',
    cpu: str(s.processor) ?? '',
    ram: ram ?? 0,
    storage,
    screen,
    specs: specLine || card.brand || '',
    price: card.price,
    mrp: card.mrp,
    image: card.thumbnail,
    videoBatteryLife: battery ? `Up to ${battery} hours of battery life` : undefined,
    weight: weightKg ? `${weightKg} kg` : undefined,
    rating: card.rating,
    reviewsCount: card.reviewCount,
    isBestSeller: card.rating >= 4.7 && card.reviewCount >= 200,
  };
}

