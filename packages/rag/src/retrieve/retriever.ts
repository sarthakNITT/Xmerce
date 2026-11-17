import { config } from "../config";
import { getVectorStore } from "../store/vector-store";
import type { Audience, ChunkMetadata, RetrievedChunk } from "../types";

export interface RetrieveOptions {
  /** Who is asking. Staff-only documents are returned only for "Staff". */
  audience?: Audience;
  topK?: number;
}

/**
 * Return the chunks most similar to the question, best first, each with its
 * cosine similarity. Chunks are not cut off at a threshold here; the caller
 * decides what counts as enough evidence.
 */
export async function retrieve(
  question: string,
  options: RetrieveOptions = {},
): Promise<RetrievedChunk[]> {
  const audience = options.audience ?? "Customer";
  const topK = options.topK ?? config.topK;
  const store = await getVectorStore();

  // The filter runs in SQL before the ranking, so customers still get topK
  // results even when staff-only chunks would have ranked higher.
  const results = await store.similaritySearchWithScore(
    question,
    topK,
    audience === "Staff" ? undefined : { audience: "Customer" },
  );

  return results
    .map(([doc, distance]) => ({
      text: doc.pageContent,
      metadata: doc.metadata as ChunkMetadata,
      // The store returns cosine distance; similarity is its complement.
      score: 1 - distance,
    }))
    .sort((a, b) => b.score - a.score);
}
