import { Pool } from "@neondatabase/serverless";
import type { Pool as PgPool } from "pg";
import { PGVectorStore } from "@langchain/community/vectorstores/pgvector";
import { config } from "../config";
import { getEmbeddings } from "../embed/embeddings";

/**
 * Chunk text, metadata (jsonb) and vector live in one row of the table
 * `rag.document_chunks` in the Neon Postgres database:
 *
 *   id uuid | content text | metadata jsonb | embedding vector(384)
 *
 * It sits in its own Postgres schema, `rag`, on purpose. The backend's tables
 * are managed by Prisma in `public`, and `prisma db push` removes tables in
 * the schema it manages that are not in schema.prisma.
 *
 * The table and the pgvector extension are created on first use if missing.
 * There is no vector index: an exact scan is instant at this size and lets
 * metadata filters run before the similarity ranking, not after it.
 */
export const CHUNK_SCHEMA = "rag";
export const CHUNK_TABLE = "document_chunks";

let pool: Pool | undefined;
let store: Promise<PGVectorStore> | undefined;

/**
 * Neon's driver speaks Postgres over a WebSocket on port 443, so it also
 * works on networks that block the usual Postgres port 5432.
 */
function getPool(): Pool {
  if (pool) return pool;
  const connectionString = config.databaseUrl();
  pool = new Pool({ connectionString });
  // Neon closes idle connections (its compute suspends after a few minutes).
  // Without a listener that surfaces as an unhandled error and stops the
  // process; the pool simply opens a new connection on the next query.
  pool.on("error", (error: Error) => {
    console.warn("[rag] idle database connection closed:", error.message);
  });
  return pool;
}

async function createVectorStore(): Promise<PGVectorStore> {
  await getPool().query(`CREATE SCHEMA IF NOT EXISTS ${CHUNK_SCHEMA}`);
  const vectorStore = await PGVectorStore.initialize(getEmbeddings(), {
    // Neon's Pool is a drop-in for the `pg` Pool; only its typings differ.
    pool: getPool() as unknown as PgPool,
    schemaName: CHUNK_SCHEMA,
    tableName: CHUNK_TABLE,
    columns: {
      idColumnName: "id",
      contentColumnName: "content",
      metadataColumnName: "metadata",
      vectorColumnName: "embedding",
    },
    distanceStrategy: "cosine",
    // Raw cosine distance; the retriever turns it into a similarity.
    scoreNormalization: "distance",
    dimensions: config.embeddingDimensions,
  });
  // PGVectorStore checks out a connection at start-up and holds it without
  // ever using it. When Neon closes that idle connection the error has no
  // handler and crashes the server, so hand it back to the pool now.
  vectorStore.client?.release();
  vectorStore.client = undefined;
  return vectorStore;
}

export function getVectorStore(): Promise<PGVectorStore> {
  store ??= createVectorStore().catch((error: unknown) => {
    store = undefined; // let the next call retry
    throw error;
  });
  return store;
}

/** Remove every chunk that came from one source file (any version). */
export async function deleteChunksForSource(sourceFile: string): Promise<void> {
  const vectorStore = await getVectorStore();
  await vectorStore.delete({ filter: { sourceFile } });
}

export async function countChunks(): Promise<number> {
  await getVectorStore(); // makes sure the table exists
  const result = await getPool().query(`SELECT COUNT(*) AS n FROM ${CHUNK_SCHEMA}.${CHUNK_TABLE}`);
  return Number(result.rows[0]?.n ?? 0);
}

/** Close the database connections (for scripts; a server keeps them open). */
export async function closeClient(): Promise<void> {
  const current = store;
  store = undefined;
  pool = undefined;
  if (current) {
    const vectorStore = await current.catch(() => undefined);
    await vectorStore?.end();
  }
}
