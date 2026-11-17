import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function numberFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (Number.isNaN(value)) {
    throw new Error(`${name} must be a number, got "${raw}"`);
  }
  return value;
}

export const config = {
  /** Folder holding the approved documents (Markdown and PDF). */
  knowledgeDir:
    process.env.RAG_KNOWLEDGE_DIR ??
    path.join(packageRoot, "data", "knowledge"),
  /**
   * Neon Postgres connection string. Read when first needed, so code that
   * never touches the store (and the tests) runs without it.
   */
  databaseUrl(): string {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error(
        "DATABASE_URL is not set. Add your Neon connection string to .env in the repo root.",
      );
    }
    return url;
  },

  embeddingModel: process.env.RAG_EMBEDDING_MODEL ?? "Xenova/bge-small-en-v1.5",
  /** Must match the embedding model's output size. */
  embeddingDimensions: numberFromEnv("RAG_EMBEDDING_DIMENSIONS", 384),

  /** Sections longer than this are split further (characters). */
  chunkSize: numberFromEnv("RAG_CHUNK_SIZE", 900),
  chunkOverlap: numberFromEnv("RAG_CHUNK_OVERLAP", 120),

  /** How many chunks are handed to the model as evidence. */
  topK: numberFromEnv("RAG_TOP_K", 4),
  /**
   * Cosine-similarity thresholds, calibrated for bge-small-en-v1.5 on the
   * seed documents (see README). Re-calibrate if the embedding model changes.
   */
  minScore: numberFromEnv("RAG_MIN_SCORE", 0.65),
  highScore: numberFromEnv("RAG_HIGH_SCORE", 0.78),

  openRouter: {
    baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api",
    model:
      process.env.RAG_ANSWER_MODEL ?? "perplexity/pplx-decider-flash-v1.3:free",
    timeoutMs: numberFromEnv("RAG_ANSWER_TIMEOUT_MS", 8_000),
  },
} as const;
