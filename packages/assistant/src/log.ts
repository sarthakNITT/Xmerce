import path from "node:path";
import { appendFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { AssistantResponse } from "./contract";

export interface InteractionLog {
  module: "AI-A";
  /** The shopper's message with personal data masked. */
  question: string;
  response: AssistantResponse;
  latency_ms: number;
  mode: AssistantResponse["mode"];
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/**
 * Step 9. There is no `ai_interaction` table in this database, so every
 * request is appended to logs/ai-interactions.jsonl (one JSON object per
 * line). Logging must never break a request, so failures are only reported.
 */
export async function logInteraction(entry: InteractionLog): Promise<void> {
  try {
    const dir = process.env.AI_LOG_DIR ?? path.join(repoRoot, "logs");
    await mkdir(dir, { recursive: true });
    await appendFile(
      path.join(dir, "ai-interactions.jsonl"),
      `${JSON.stringify({ timestamp: new Date().toISOString(), ...entry })}\n`,
    );
  } catch (error) {
    console.error("[assistant] could not write the interaction log:", error);
  }
}
