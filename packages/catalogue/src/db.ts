import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "./generated/prisma/client";

let client: PrismaClient | undefined;

/**
 * Prisma client for the catalogue tables.
 *
 * It connects through Neon's driver adapter, which speaks Postgres over a
 * WebSocket on port 443. Prisma's default connection uses port 5432, which
 * some networks block.
 */
export function getPrisma(): PrismaClient {
  if (client) return client;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to .env in the repo root.",
    );
  }
  client = new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
  return client;
}

/** Close the connection (for scripts; a server keeps it open). */
export async function disconnect(): Promise<void> {
  const current = client;
  client = undefined;
  await current?.$disconnect();
}
