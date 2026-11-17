import { config } from "../config";
import { deleteChunksForSource, getVectorStore } from "../store/vector-store";
import type { LoadedDocument } from "../types";
import { chunkDocument, documentId } from "./chunker";
import { loadKnowledgeDir } from "./loaders";

export interface IngestResult {
  documentId: string;
  title: string;
  version: string;
  sections: number;
  chunks: number;
}

/**
 * Chunk, embed and store one document. Re-ingesting a file replaces the
 * chunks stored for it earlier, so the seed script can be run again safely.
 */
export async function ingestDocument(doc: LoadedDocument): Promise<IngestResult> {
  const chunks = await chunkDocument(doc);
  if (chunks.length === 0) {
    throw new Error(`${doc.sourceFile} has no text to index`);
  }
  const store = await getVectorStore();
  await deleteChunksForSource(doc.sourceFile);
  await store.addDocuments(chunks);
  return {
    documentId: documentId(doc),
    title: doc.metadata.title,
    version: doc.metadata.version,
    sections: doc.sections.length,
    chunks: chunks.length,
  };
}

/** Ingest every approved document in the knowledge folder. */
export async function ingestKnowledgeDir(
  dir: string = config.knowledgeDir,
): Promise<IngestResult[]> {
  const documents = await loadKnowledgeDir(dir);
  const results: IngestResult[] = [];
  for (const doc of documents) {
    results.push(await ingestDocument(doc));
  }
  return results;
}
