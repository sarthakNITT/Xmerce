/** Response of POST /api/ai/knowledge/ask (see packages/rag). */
export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface KnowledgeSource {
  document: string;
  section: string;
  version: string;
  /** Similarity between the question and this section, 0 to 1. */
  score: number;
}

export interface KnowledgeAnswer {
  answer: string;
  confidence: Confidence;
  sources: KnowledgeSource[];
  followUpRequired: boolean;
  status: "ANSWERED" | "NOT_FOUND" | "UNAVAILABLE";
  nextStep: { type: "SUPPORT_TICKET"; label: string; endpoint: string } | null;
}

export function isKnowledgeAnswer(value: unknown): value is KnowledgeAnswer {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.answer === "string" &&
    typeof v.confidence === "string" &&
    typeof v.status === "string" &&
    typeof v.followUpRequired === "boolean" &&
    Array.isArray(v.sources)
  );
}
