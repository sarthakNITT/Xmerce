import type { Candidate } from "@repo/catalogue";
import { z } from "zod";
import { formatInr } from "./budget";
import {
  AssistantResponseSchema,
  ExtractionSchema,
  RankSchema,
  type AssistantResponse,
  type Extraction,
  type Priority,
  type Rank,
  type Recommendation,
} from "./contract";
import { deciderLlm, LlmExtractionSchema, type AssistantLlm } from "./llm";
import { logInteraction, type InteractionLog } from "./log";
import { maskSensitive } from "./privacy";
import { isGrounded, templateReason } from "./reasons";
import {
  categoryFromKeywords,
  numericConstraints,
  prioritiesFromKeywords,
  rankByRules,
  useCaseFromKeywords,
} from "./rules";
import { catalogueTools, enforceBudget, type CatalogueTools, type SearchArgs } from "./tools";

export const MAX_RECOMMENDATIONS = 3;
/** How many closest options to show when nothing fits the budget. */
const ABOVE_BUDGET_OPTIONS = 2;

/** Saved on the customer profile; they only fill gaps in what was just said. */
export interface Preferences {
  budget?: number | null;
  useCase?: string | null;
  brand?: string | null;
}

export interface AssistantInput {
  message: string;
  /** Only for a signed-in customer. Never includes name, email, phone or address. */
  preferences?: Preferences;
}

export interface AssistantDeps {
  tools: CatalogueTools;
  llm: AssistantLlm;
  /** False switches the model off entirely (env AI_ENABLED=false). */
  aiEnabled: boolean;
  /** Total time the model may take across all its calls in one request. */
  timeoutMs: number;
  log: (entry: InteractionLog) => Promise<void> | void;
}

export function defaultDeps(): AssistantDeps {
  return {
    tools: catalogueTools,
    llm: deciderLlm,
    aiEnabled: process.env.AI_ENABLED !== "false",
    timeoutMs: Number(process.env.AI_TIMEOUT_MS ?? 9000),
    log: logInteraction,
  };
}

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const SINGULAR: Record<string, string> = {
  laptops: "laptop",
  gaming: "gaming laptop",
  desktops: "desktop",
  "all-in-one": "all-in-one PC",
  monitors: "monitor",
  accessories: "accessory",
  "add-ons": "add-on plan",
};
const singular = (category: string | null) =>
  category ? (SINGULAR[slugOf(category)] ?? category.toLowerCase()) : "product";

const PRIORITY_WORDS: Record<Priority, string> = {
  battery: "long battery life",
  portability: "light and easy to carry",
  performance: "strong performance",
  display: "a good display",
};

const storageWords = (gb: number) =>
  gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;

/** The "what I understood" line, written by code from the extracted fields. */
export function describeRequirement(extraction: Extraction): string {
  const label = singular(extraction.category);
  // "Gaming laptop for gaming" says the same thing twice.
  const use =
    extraction.useCase && !label.toLowerCase().includes(extraction.useCase.toLowerCase())
      ? ` for ${extraction.useCase}`
      : "";
  const head = `${label.charAt(0).toUpperCase()}${label.slice(1)}${use}`;
  const extras = [
    ...extraction.priorities.map((priority) => PRIORITY_WORDS[priority]),
    extraction.minRamGb ? `at least ${extraction.minRamGb} GB RAM` : null,
    extraction.minStorageGb ? `at least ${storageWords(extraction.minStorageGb)} storage` : null,
    extraction.maxWeightKg ? `under ${extraction.maxWeightKg} kg` : null,
    extraction.brand ? `${extraction.brand} brand` : null,
  ].filter((part): part is string => part !== null);
  return extras.length > 0 ? `${head}, ${extras.join(", ")}` : head;
}

/** "for writing." -> "writing": the model returns the passage as it was typed. */
function cleanUseCase(useCase: string | null | undefined): string | null {
  const cleaned = (useCase ?? "")
    .trim()
    .replace(/^(?:for|to)\s+/i, "")
    .replace(/[\s.,;:!?]+$/, "");
  return cleaned.length > 0 ? cleaned : null;
}

class ModelTimeout extends Error {}

/**
 * Run one model step and validate its output with zod. A failed validation
 * is retried once, with the error passed back; a second failure throws, and
 * the caller falls back to rules. A model that is down or too slow throws
 * straight away.
 */
async function callValidated<S extends z.ZodType>(
  schema: S,
  call: (feedback?: string) => Promise<unknown>,
  remainingMs: () => number,
): Promise<z.infer<S>> {
  let feedback: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const budget = remainingMs();
    if (budget <= 0) throw new ModelTimeout("The model ran out of time");
    let timer: ReturnType<typeof setTimeout> | undefined;
    const raw = await Promise.race([
      call(feedback),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new ModelTimeout("The model timed out")), budget);
      }),
    ]).finally(() => clearTimeout(timer));
    const parsed = schema.safeParse(raw);
    if (parsed.success) return parsed.data;
    feedback = z.prettifyError(parsed.error);
  }
  throw new Error(`The model's output was invalid twice: ${feedback}`);
}

function toRecommendation(
  candidate: Candidate,
  reason: string,
  budget: number | null,
): Recommendation {
  // Price, SKU and availability always come from the catalogue row.
  return {
    productId: candidate.productId,
    productName: candidate.productName,
    reason,
    availability: candidate.availability,
    sku: candidate.sku,
    price: candidate.price,
    aboveBudget: budget !== null && candidate.price > budget,
  };
}

/**
 * Step 7: turn a ranking into recommendations, trusting nothing in it except
 * the order.
 */
export function validatePicks(
  rank: Rank,
  candidates: Candidate[],
  budget: number | null,
  priorities: Priority[],
): Recommendation[] {
  const byId = new Map(candidates.map((candidate) => [candidate.productId, candidate]));
  const seen = new Set<string>();
  // Drop ids that are not candidates (invented products) and repeats.
  const picks = rank.picks.filter((pick) => {
    if (!byId.has(pick.productId) || seen.has(pick.productId)) return false;
    seen.add(pick.productId);
    return true;
  });
  // Anything the model left out still counts as a lower-ranked alternative.
  const ordered = [
    ...picks,
    ...candidates
      .filter((candidate) => !seen.has(candidate.productId))
      .map((candidate) => ({ productId: candidate.productId, reason: null })),
  ];

  const reasonFor = (candidate: Candidate, written: string | null) =>
    written && written.trim() !== "" && isGrounded(written, candidate, budget)
      ? written.trim()
      : templateReason(candidate, budget, priorities);

  const chosen = ordered.slice(0, MAX_RECOMMENDATIONS);
  const result: Recommendation[] = [];
  const listed = new Set<string>();
  const add = (pick: { productId: string; reason: string | null }) => {
    const candidate = byId.get(pick.productId);
    if (!candidate || listed.has(candidate.productId)) return;
    listed.add(candidate.productId);
    result.push(toRecommendation(candidate, reasonFor(candidate, pick.reason), budget));
  };

  for (const pick of chosen) {
    add(pick);
    // An out-of-stock pick stays, marked as such, followed by the best
    // alternative that can actually be bought.
    if (byId.get(pick.productId)?.availability === "OUT_OF_STOCK") {
      const alternative = ordered.find(
        (other) =>
          !listed.has(other.productId) &&
          !chosen.some((c) => c.productId === other.productId) &&
          byId.get(other.productId)?.availability !== "OUT_OF_STOCK",
      );
      if (alternative) add(alternative);
    }
  }

  return (
    result
      .slice(0, MAX_RECOMMENDATIONS)
      // Budget guardrail: nothing over budget unless it says so.
      .filter((rec) => budget === null || rec.price <= budget || rec.aboveBudget)
  );
}

function clarifyingQuestion(extraction: Extraction): string | null {
  const asks: string[] = [];
  if (!extraction.category) {
    asks.push(
      "what kind of product you are looking for (a laptop, desktop, all-in-one PC, monitor or accessory)",
    );
  }
  if (extraction.budget === null) asks.push("your budget");
  if (!extraction.useCase) {
    asks.push(`what you will mainly use the ${singular(extraction.category)} for`);
  }
  if (asks.length === 0) return null;
  const list =
    asks.length === 1
      ? asks[0]
      : `${asks.slice(0, -1).join(", ")} and ${asks[asks.length - 1]}`;
  return `To recommend the right product, could you tell me ${list}?`;
}

/** Search arguments for the extracted requirement; maxPrice is the budget. */
function searchArgs(extraction: Extraction): SearchArgs {
  return {
    category: extraction.category,
    minRamGb: extraction.minRamGb,
    minStorageGb: extraction.minStorageGb,
    maxWeightKg: extraction.maxWeightKg,
    brand: extraction.brand,
    useCase: extraction.useCase,
  };
}

function wantedWords(extraction: Extraction): string {
  const extras = [
    extraction.brand,
    singular(extraction.category),
    extraction.minRamGb ? `with at least ${extraction.minRamGb} GB RAM` : null,
    extraction.minStorageGb
      ? `with at least ${storageWords(extraction.minStorageGb)} storage`
      : null,
    extraction.maxWeightKg ? `under ${extraction.maxWeightKg} kg` : null,
  ].filter((part): part is string => Boolean(part));
  return extras.join(" ");
}

export async function runAssistant(
  input: AssistantInput,
  deps: AssistantDeps = defaultDeps(),
): Promise<AssistantResponse> {
  const started = Date.now();
  const remainingMs = () => deps.timeoutMs - (Date.now() - started);
  const message = input.message.trim();
  // Step 1: personal data never reaches the model or the log.
  const masked = maskSensitive(message);
  let usedFallback = !deps.aiEnabled;

  const [categories, brands] = await Promise.all([
    deps.tools.listCategories(),
    deps.tools.listBrands(),
  ]);
  const realCategory = (name: string | null) =>
    categories.find((c) => c.toLowerCase() === name?.toLowerCase()) ?? null;

  // Step 2: EXTRACT. Numbers and brand are always read by rules.
  const rules = numericConstraints(message, brands);
  let understood: { category: string | null; useCase: string | null; priorities: Priority[]; budget: number | null };
  try {
    if (usedFallback) throw new Error("AI is switched off");
    const fromModel = await callValidated(
      LlmExtractionSchema,
      (feedback) => deps.llm.extract(masked, categories, feedback),
      remainingMs,
    );
    understood = {
      // A category that does not exist is treated as not stated. Where the
      // model finds no category or use, an explicit keyword still counts
      // ("gaming laptop" states its use), which keeps answers repeatable.
      category:
        realCategory(fromModel.category) ?? categoryFromKeywords(message, categories),
      useCase: fromModel.useCase ?? useCaseFromKeywords(message),
      priorities: fromModel.priorities,
      budget: fromModel.budget,
    };
  } catch (error) {
    if (deps.aiEnabled) console.error("[assistant] extract fell back to rules:", error);
    usedFallback = true;
    understood = {
      category: categoryFromKeywords(message, categories),
      useCase: useCaseFromKeywords(message),
      priorities: prioritiesFromKeywords(message),
      budget: null,
    };
  }

  const preferences = input.preferences ?? {};
  const preferredBrand = brands.find(
    (brand) => brand.toLowerCase() === preferences.brand?.toLowerCase(),
  );
  const extraction: Extraction = ExtractionSchema.parse({
    category: understood.category,
    // The regex wins over the model; saved preferences only fill gaps.
    budget: rules.budget ?? understood.budget ?? preferences.budget ?? null,
    useCase: cleanUseCase(understood.useCase) ?? cleanUseCase(preferences.useCase),
    minRamGb: rules.minRamGb,
    minStorageGb: rules.minStorageGb,
    maxWeightKg: rules.maxWeightKg,
    brand: rules.brand ?? preferredBrand ?? null,
    priorities: understood.priorities,
  });
  const { budget } = extraction;

  const finish = async (
    partial: Pick<AssistantResponse, "recommendations" | "clarifyingQuestion" | "message">,
  ): Promise<AssistantResponse> => {
    const response = AssistantResponseSchema.parse({
      interpretedRequirement: describeRequirement(extraction),
      budget,
      ...partial,
      mode: usedFallback ? "fallback" : "ai",
    });
    await deps.log({
      module: "AI-A",
      question: masked,
      response,
      latency_ms: Date.now() - started,
      mode: response.mode,
    });
    return response;
  };

  // Step 3: CLARIFY, before any catalogue search.
  const question = clarifyingQuestion(extraction);
  if (question) {
    return finish({ recommendations: [], clarifyingQuestion: question, message: null });
  }

  // Step 4: SEARCH. The budget is fixed here in code.
  const candidates = await deps.tools.searchProducts(
    enforceBudget(searchArgs(extraction), budget),
  );

  // Step 5: NOTHING MATCHES. Never invent: show the closest real options.
  if (candidates.length === 0) {
    const closest = (
      await deps.tools.searchProducts(
        enforceBudget({ ...searchArgs(extraction), ignoreBudget: true }, budget, true),
      )
    )
      .sort((a, b) => a.price - b.price)
      .slice(0, ABOVE_BUDGET_OPTIONS);
    if (closest.length === 0) {
      return finish({
        recommendations: [],
        clarifyingQuestion: null,
        message: `We don't have a ${wantedWords(extraction)} in our catalogue, so there is nothing to recommend for this.`,
      });
    }
    return finish({
      recommendations: closest.map((candidate) =>
        toRecommendation(candidate, templateReason(candidate, budget, extraction.priorities), budget),
      ),
      clarifyingQuestion: null,
      message: `Nothing in our catalogue matches a ${wantedWords(extraction)} at or under ${formatInr(budget ?? 0)}. ${closest.length === 1 ? "The closest option is" : "The closest options are"} shown below, marked as above budget. Would you like to raise your budget?`,
    });
  }

  // Step 6: RANK, from the candidates' real data only.
  let rank: Rank;
  try {
    if (usedFallback) throw new Error("AI is not in use for this request");
    rank =
      candidates.length === 1
        ? { picks: [{ productId: candidates[0]!.productId, reason: null }] }
        : await callValidated(
            RankSchema,
            (feedback) =>
              deps.llm.rank(
                {
                  interpretedRequirement: describeRequirement(extraction),
                  budget,
                  priorities: extraction.priorities,
                },
                candidates,
                feedback,
              ),
            remainingMs,
          );
  } catch (error) {
    if (deps.aiEnabled && !usedFallback) {
      console.error("[assistant] rank fell back to rules:", error);
    }
    usedFallback = true;
    rank = rankByRules(candidates, extraction.priorities);
  }

  // Step 7: VALIDATE. If every pick was invented, rank by rules instead.
  const known = new Set(candidates.map((candidate) => candidate.productId));
  if (!rank.picks.some((pick) => known.has(pick.productId))) {
    usedFallback = true;
    rank = rankByRules(candidates, extraction.priorities);
  }
  const recommendations = validatePicks(rank, candidates, budget, extraction.priorities);

  return finish({ recommendations, clarifyingQuestion: null, message: null });
}
