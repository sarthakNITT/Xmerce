/**
 * Seed script: chunk, embed and store every approved document.
 *
 *   bun run ingest
 */
import { config } from "../config";
import { ingestKnowledgeDir } from "../ingest/ingest";
import { closeClient, countChunks } from "../store/vector-store";

console.log(`Ingesting documents from ${config.knowledgeDir}`);
const results = await ingestKnowledgeDir();
console.table(
  results.map(({ title, version, sections, chunks }) => ({
    title,
    version,
    sections,
    chunks,
  })),
);
console.log(
  `${results.length} documents, ${await countChunks()} chunks stored in the Neon table "rag.document_chunks"`,
);
await closeClient();
