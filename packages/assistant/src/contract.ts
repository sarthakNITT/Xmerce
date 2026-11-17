import { z } from "zod";

export const AvailabilitySchema = z.enum(["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]);

export const RecommendationSchema = z.strictObject({
  productId: z.string().min(1),
  productName: z.string().min(1),
  reason: z.string().min(1),
  availability: AvailabilitySchema,
  sku: z.string().min(1),
  /** Whole rupees, always taken from the catalogue. */
  price: z.number().int().nonnegative(),
  aboveBudget: z.boolean(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

/** What POST /api/ai/assistant returns. Validated before it leaves the service. */
export const AssistantResponseSchema = z.strictObject({
  interpretedRequirement: z.string(),
  budget: z.number().int().positive().nullable(),
  recommendations: z.array(RecommendationSchema).max(3),
  clarifyingQuestion: z.string().min(1).nullable(),
  message: z.string().min(1).nullable(),
  /** "ai" when the model was used for every step; "fallback" when rules took over. */
  mode: z.enum(["ai", "fallback"]),
});
export type AssistantResponse = z.infer<typeof AssistantResponseSchema>;

export const PRIORITIES = ["battery", "portability", "performance", "display"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Step 2: what the shopper asked for. Missing things stay null, never guessed. */
export const ExtractionSchema = z.strictObject({
  /** A real category name from the catalogue, or null. */
  category: z.string().min(1).nullable(),
  budget: z.number().int().positive().nullable(),
  useCase: z.string().min(1).nullable(),
  minRamGb: z.number().positive().nullable(),
  minStorageGb: z.number().positive().nullable(),
  maxWeightKg: z.number().positive().nullable(),
  brand: z.string().min(1).nullable(),
  priorities: z.array(z.enum(PRIORITIES)),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

/** Step 6: the model's ranking. A reason is optional; code checks or writes it. */
export const RankSchema = z.strictObject({
  picks: z
    .array(
      z.strictObject({
        productId: z.string().min(1),
        reason: z.string().nullable(),
      }),
    )
    .max(10),
});
export type Rank = z.infer<typeof RankSchema>;
