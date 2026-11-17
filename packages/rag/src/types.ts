import { z } from "zod";

/** Metadata every approved document must carry (NS-I1). */
export const DocumentMetadataSchema = z.object({
  title: z.string().min(1),
  docType: z.enum(["Policy", "Manual", "Membership", "Procedure"]),
  version: z.string().min(1),
  effectiveDate: z.iso.date(),
  region: z.string().min(1),
  productCategory: z.string().min(1),
  audience: z.enum(["Customer", "Staff"]),
  tier: z.enum(["All", "Standard", "Silver", "Gold"]),
});
export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

export type Audience = DocumentMetadata["audience"];

/** Stored with every chunk, next to its text and vector. */
export interface ChunkMetadata extends DocumentMetadata {
  /** Stable id: "<source file>@<version>". */
  documentId: string;
  sourceFile: string;
  /** The heading the chunk sits under; shown to users as the source section. */
  section: string;
  chunkIndex: number;
}

/** One section of a loaded document, before chunking. */
export interface DocumentSection {
  heading: string;
  text: string;
}

export interface LoadedDocument {
  sourceFile: string;
  metadata: DocumentMetadata;
  sections: DocumentSection[];
}

export interface RetrievedChunk {
  text: string;
  metadata: ChunkMetadata;
  /** Cosine similarity to the question, 0 to 1. */
  score: number;
}

export const ConfidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);
export type Confidence = z.infer<typeof ConfidenceSchema>;

/**
 * Response contract for AI-B (use-case section 3.9). The first four fields are
 * the contract; `status`, `nextStep` and `sources[].score` are additions.
 */
export const KnowledgeAnswerSchema = z.object({
  answer: z.string().min(1),
  confidence: ConfidenceSchema,
  sources: z.array(
    z.object({
      document: z.string(),
      section: z.string(),
      version: z.string(),
      score: z.number(),
    }),
  ),
  followUpRequired: z.boolean(),
  status: z.enum(["ANSWERED", "NOT_FOUND", "UNAVAILABLE"]),
  nextStep: z
    .object({
      type: z.literal("SUPPORT_TICKET"),
      label: z.string(),
      endpoint: z.string(),
    })
    .nullable(),
});
export type KnowledgeAnswer = z.infer<typeof KnowledgeAnswerSchema>;
