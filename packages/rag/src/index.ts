export {
  askKnowledge,
  knowledgeChain,
  type AskInput,
  type HistoryTurn,
} from "./chain";
export { retrieve, type RetrieveOptions } from "./retrieve/retriever";
export {
  ingestDocument,
  ingestKnowledgeDir,
  type IngestResult,
} from "./ingest/ingest";
export { loadKnowledgeDir, parseMarkdown, parsePdf } from "./ingest/loaders";
export { chunkDocument } from "./ingest/chunker";
export { closeClient, countChunks } from "./store/vector-store";
export { config } from "./config";
export {
  DocumentMetadataSchema,
  KnowledgeAnswerSchema,
  type Audience,
  type ChunkMetadata,
  type Confidence,
  type DocumentMetadata,
  type KnowledgeAnswer,
  type LoadedDocument,
  type RetrievedChunk,
} from "./types";
