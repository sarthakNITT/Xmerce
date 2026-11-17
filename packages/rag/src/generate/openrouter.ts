import { config } from "../config";

/**
 * Minimal client for the two OpenRouter routes the Perplexity Decider models
 * serve. These models do not write text: `/alpha/decisions` returns
 * probabilities for typed questions and `/alpha/extractions` returns passages
 * copied out of the text it is given.
 *
 * Docs: https://openrouter.ai/docs/guides/features/decisions
 *       https://openrouter.ai/docs/guides/community/extractions
 */

export class OpenRouterError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "OpenRouterError";
  }
}

export type DecisionQuestion =
  | { type: "noul"; instructions: string }
  | { type: "choice"; instructions: string; criteria: Record<string, string> }
  | { type: "score"; instructions: string; criteria: string[] };

export type DecisionAnswer =
  | { type: "noul"; noul: number; confidence?: number }
  | {
      type: "choice";
      choice: string;
      probabilities?: Record<string, number>;
      confidence?: number;
    }
  | {
      type: "score";
      score: number;
      probabilities?: Record<string, number>;
      confidence?: number;
    }
  | { type: "refusal" };

export type ExtractionField =
  | { type: "text"; instructions?: string }
  | { type: "list"; items: "text"; instructions?: string };

/** `[start, end)` in Unicode code points into the state text. */
export type Span = [number, number];

export type ExtractionAnswer =
  | { type: "text"; value: string | null; span?: Span | null; confidence?: number }
  | {
      type: "list";
      value: string[] | null;
      spans?: (Span | null)[];
      confidences?: number[];
      confidence?: number;
    }
  | { type: "refusal" };

async function post<T>(route: string, body: object): Promise<T> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new OpenRouterError("OPENROUTER_API_KEY is not set");
  }
  let response: Response;
  try {
    response = await fetch(`${config.openRouter.baseUrl}${route}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: config.openRouter.model, ...body }),
      signal: AbortSignal.timeout(config.openRouter.timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new OpenRouterError(`Request to ${route} failed: ${reason}`);
  }
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new OpenRouterError(
      `${route} returned ${response.status}: ${detail}`,
      response.status,
    );
  }
  return (await response.json()) as T;
}

export async function decide<K extends string>(
  state: string,
  questions: Record<K, DecisionQuestion>,
): Promise<Partial<Record<K, DecisionAnswer>>> {
  const result = await post<{ answers?: Partial<Record<K, DecisionAnswer>> }>(
    "/alpha/decisions",
    { state, questions },
  );
  return result.answers ?? {};
}

export async function extract<K extends string>(
  state: string,
  fields: Record<K, ExtractionField>,
): Promise<Partial<Record<K, ExtractionAnswer>>> {
  const result = await post<{ answers?: Partial<Record<K, ExtractionAnswer>> }>(
    "/alpha/extractions",
    { state, fields },
  );
  return result.answers ?? {};
}
