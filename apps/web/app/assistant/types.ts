/** Response of POST /api/ai/assistant (see packages/assistant). */
export type Availability = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface Recommendation {
  productId: string;
  productName: string;
  reason: string;
  availability: Availability;
  sku: string;
  /** Whole rupees. */
  price: number;
  aboveBudget: boolean;
}

export interface AssistantResponse {
  interpretedRequirement: string;
  budget: number | null;
  recommendations: Recommendation[];
  clarifyingQuestion: string | null;
  message: string | null;
  mode: "ai" | "fallback";
}

export function isAssistantResponse(value: unknown): value is AssistantResponse {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.interpretedRequirement === "string" &&
    Array.isArray(v.recommendations) &&
    (v.mode === "ai" || v.mode === "fallback")
  );
}
