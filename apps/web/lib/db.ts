import { neon } from '@neondatabase/serverless';
import { PRODUCTS, type Product } from '../data/products';

const databaseUrl = process.env.DATABASE_URL || '';

export function getDb() {
  return neon(databaseUrl);
}

export async function initDbAndSyncProducts() {
  try {
    const sql = getDb();

    // 1. Create products table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS novatech_products (
        id VARCHAR(50) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        cpu VARCHAR(100) DEFAULT '',
        ram INT DEFAULT 0,
        specs TEXT NOT NULL,
        price INT NOT NULL,
        mrp INT,
        image TEXT,
        video_battery_life VARCHAR(150),
        weight VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. Create orders table if not exists
    await sql`
      CREATE TABLE IF NOT EXISTS novatech_orders (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) DEFAULT 'Guest Customer',
        customer_email VARCHAR(255) DEFAULT 'guest@novatech.local',
        items JSONB NOT NULL,
        subtotal INT NOT NULL,
        status VARCHAR(50) DEFAULT 'CONFIRMED',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 3. Seed / sync products if empty
    const existing = await sql`SELECT COUNT(*)::int as count FROM novatech_products`;
    if (existing[0]?.count === 0) {
      for (const p of PRODUCTS) {
        await sql`
          INSERT INTO novatech_products (id, name, category, cpu, ram, specs, price, mrp, image, video_battery_life, weight)
          VALUES (
            ${p.id},
            ${p.name},
            ${p.category},
            ${p.cpu},
            ${p.ram},
            ${p.specs},
            ${p.price},
            ${p.mrp},
            ${p.image},
            ${p.videoBatteryLife || null},
            ${p.weight || null}
          )
          ON CONFLICT (id) DO NOTHING;
        `;
      }
    }

    return { success: true };
  } catch (error) {
    console.error('Failed to initialize or sync database:', error);
    return { success: false, error: String(error) };
  }
}

export async function fetchProductsFromDb(): Promise<Product[]> {
  try {
    const sql = getDb();
    const rows = await sql`SELECT * FROM novatech_products ORDER BY price ASC`;
    if (!rows || rows.length === 0) {
      return PRODUCTS;
    }
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      category: r.category,
      brand: r.brand || 'NovaTech',
      cpu: r.cpu || '',
      ram: Number(r.ram) || 0,
      specs: r.specs,
      price: Number(r.price),
      mrp: r.mrp ? Number(r.mrp) : null,
      image: r.image || null,
      videoBatteryLife: r.video_battery_life || undefined,
      weight: r.weight || undefined,
    }));
  } catch (error) {
    console.warn('Falling back to local catalogue data due to DB notice:', error);
    return PRODUCTS;
  }
}

export async function createOrder(items: Record<string, number>, subtotal: number) {
  try {
    const sql = getDb();
    const result = await sql`
      INSERT INTO novatech_orders (items, subtotal, status)
      VALUES (${JSON.stringify(items)}, ${subtotal}, 'CONFIRMED')
      RETURNING id, status, created_at;
    `;
    return { success: true, order: result[0] };
  } catch (error) {
    console.error('Order creation error:', error);
    return { success: false, error: String(error) };
  }
}
