export interface Product {
  id: string;
  name: string;
  category: 'Laptops' | 'Desktops' | 'All-in-One' | 'Gaming' | 'Monitors' | 'Accessories';
  brand: string;
  cpu: string;
  ram: number;
  storage?: string | null;
  screen?: string | null;
  specs: string;
  price: number;
  mrp: number | null;
  image: string | null;
  videoBatteryLife?: string;
  weight?: string;
  rating?: number;
  reviewsCount?: number;
  isBestSeller?: boolean;
}

export const PRODUCTS: Product[] = [
  {
    id: 'LAP-101',
    name: 'NovaBook Air 14',
    category: 'Laptops',
    brand: 'NovaTech',
    cpu: 'Core Ultra 5',
    ram: 16,
    storage: '512 GB SSD',
    screen: '14-inch',
    specs: '16 GB · 512 GB SSD · 14-inch 2.2K · 1.3 kg',
    price: 64990,
    mrp: 74990,
    image: null,
    videoBatteryLife: 'Up to 18 hours of video playback',
    weight: '1.3 kg',
    rating: 4.7,
    reviewsCount: 342,
    isBestSeller: true,
  },
  {
    id: 'LAP-104',
    name: 'NovaBook Pro 15',
    category: 'Laptops',
    brand: 'NovaTech',
    cpu: 'Core Ultra 7',
    ram: 16,
    storage: '1 TB SSD',
    screen: '15.6-inch',
    specs: '16 GB · 1 TB SSD · 15.6-inch OLED · 1.6 kg',
    price: 89990,
    mrp: 97990,
    image: null,
    weight: '1.6 kg',
    rating: 4.8,
    reviewsCount: 215,
    isBestSeller: true,
  },
  {
    id: 'LAP-103',
    name: 'NovaBook Go 14',
    category: 'Laptops',
    brand: 'NovaTech',
    cpu: 'Ryzen 5',
    ram: 16,
    storage: '512 GB SSD',
    screen: '14-inch',
    specs: '16 GB · 512 GB SSD · 14-inch FHD · 1.4 kg',
    price: 54990,
    mrp: 59990,
    image: null,
    weight: '1.4 kg',
    rating: 4.5,
    reviewsCount: 128,
  },
  {
    id: 'DSK-301',
    name: 'NovaDesk Tower T5',
    category: 'Desktops',
    brand: 'NovaTech',
    cpu: 'Core i5',
    ram: 16,
    storage: '1 TB SSD',
    screen: '24-inch',
    specs: '16 GB · 1 TB SSD · 24-inch monitor included',
    price: 54990,
    mrp: 60990,
    image: null,
    rating: 4.4,
    reviewsCount: 76,
  },
  {
    id: 'LAP-102',
    name: 'NovaBook Air 15',
    category: 'Laptops',
    brand: 'NovaTech',
    cpu: 'Core Ultra 5',
    ram: 16,
    storage: '512 GB SSD',
    screen: '15.3-inch',
    specs: '16 GB · 512 GB SSD · 15.3-inch FHD+ · 1.5 kg',
    price: 69990,
    mrp: 76990,
    image: null,
    weight: '1.5 kg',
    rating: 4.6,
    reviewsCount: 164,
  },
  {
    id: 'LAP-201',
    name: 'Nova Gaming X17',
    category: 'Gaming',
    brand: 'NovaTech',
    cpu: 'Ryzen 9',
    ram: 32,
    storage: '1 TB SSD',
    screen: '17-inch',
    specs: '32 GB · RTX 5070 · 165 Hz',
    price: 149990,
    mrp: 164990,
    image: null,
    rating: 4.9,
    reviewsCount: 189,
    isBestSeller: true,
  },
  {
    id: 'AIO-401',
    name: 'NovaDesk One 24',
    category: 'All-in-One',
    brand: 'NovaTech',
    cpu: 'Core i5',
    ram: 16,
    storage: '512 GB SSD',
    screen: '24-inch',
    specs: '16 GB · 512 GB SSD · 24-inch FHD',
    price: 72990,
    mrp: 79990,
    image: null,
    rating: 4.5,
    reviewsCount: 92,
  },
  {
    id: 'ADD-501',
    name: 'NovaCare 3-Year Plan',
    category: 'Accessories',
    brand: 'NovaTech',
    cpu: '',
    ram: 0,
    storage: null,
    screen: null,
    specs: 'Accidental damage cover for one laptop',
    price: 5999,
    mrp: null,
    image: null,
    rating: 4.8,
    reviewsCount: 420,
  },
];

export const CATEGORIES = [
  'Laptops',
  'Desktops',
  'All-in-One',
  'Gaming',
  'Monitors',
  'Accessories',
] as const;

export type CategoryType = (typeof CATEGORIES)[number] | 'All';

export const FACETS_CONFIG = {
  category: { title: 'Category', values: [...CATEGORIES] },
  brand: { title: 'Brand', values: ['NovaTech'] },
  cpu: {
    title: 'Processor',
    values: ['Core Ultra 5', 'Core Ultra 7', 'Core i5', 'Ryzen 5', 'Ryzen 9'],
  },
  ram: {
    title: 'Memory (RAM)',
    values: ['8', '16', '32', '64'],
    label: (v: string) => `${v} GB`,
  },
  storage: {
    title: 'Storage',
    values: ['256 GB SSD', '512 GB SSD', '1 TB SSD', '2 TB SSD'],
  },
  screen: {
    title: 'Screen size',
    values: ['14-inch', '15.3-inch', '15.6-inch', '17-inch', '24-inch'],
  },
};

export function formatINR(val: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(val);
}

export function calculateSaving(mrp: number | null, price: number): number | null {
  if (!mrp || mrp <= price) return null;
  return mrp - price;
}
