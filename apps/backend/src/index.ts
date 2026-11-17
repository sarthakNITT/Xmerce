import { runAssistant } from "@repo/assistant";
import { askKnowledge, type HistoryTurn } from "@repo/rag";

const MAX_QUESTION_LENGTH = 1000;
/** Only the most recent turns matter for a follow-up question. */
const MAX_HISTORY_TURNS = 6;

/** Earlier questions sent by the client; anything malformed is dropped. */
function parseHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  const turns: HistoryTurn[] = [];
  for (const item of raw.slice(-MAX_HISTORY_TURNS)) {
    if (typeof item !== "object" || item === null) continue;
    const { question, document } = item as Record<string, unknown>;
    if (typeof question !== "string" || question.trim() === "") continue;
    turns.push({
      question: question.slice(0, MAX_QUESTION_LENGTH),
      document:
        typeof document === "string" && document.trim() !== ""
          ? document.slice(0, 200)
          : undefined,
    });
  }
  return turns;
}

/**
 * AI-B: POST /api/ai/knowledge/ask
 *   { "question": "...", "history": [{ "question": "...", "document": "..." }] }
 * `history` is optional: the earlier questions of the conversation, oldest
 * first, so a follow-up such as "what about laptops" can be understood.
 */
async function handleKnowledgeAsk(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const question =
    typeof body === "object" && body !== null && "question" in body
      ? body.question
      : undefined;
  if (typeof question !== "string" || question.trim() === "") {
    return Response.json({ error: "question is required" }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { error: `question must be at most ${MAX_QUESTION_LENGTH} characters` },
      { status: 400 },
    );
  }
  try {
    // Every caller is treated as a customer until sign-in exists, so
    // staff-only documents are never used.
    const history = parseHistory(
      typeof body === "object" && body !== null && "history" in body
        ? body.history
        : undefined,
    );
    return Response.json(
      await askKnowledge({ question, audience: "Customer", history }),
    );
  } catch (error) {
    console.error("[knowledge] ask failed:", error);
    return Response.json(
      { error: "The knowledge assistant is unavailable right now." },
      { status: 503 },
    );
  }
}

/**
 * AI-A: POST /api/ai/assistant  { "message": "..." }
 * A shopper's need in plain language -> up to three real catalogue products.
 */
async function handleAssistant(req: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body must be JSON" }, { status: 400 });
  }
  const message =
    typeof body === "object" && body !== null && "message" in body
      ? body.message
      : undefined;
  if (typeof message !== "string" || message.trim() === "") {
    return Response.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { error: `message must be at most ${MAX_QUESTION_LENGTH} characters` },
      { status: 400 },
    );
  }
  try {
    // No sign-in exists yet, so there are no saved preferences to pass.
    // A model failure never reaches here: the service falls back to rules.
    return Response.json(await runAssistant({ message }));
  } catch (error) {
    // Only the catalogue database being unreachable ends up here.
    console.error("[assistant] request failed:", error);
    return Response.json(
      { error: "The product catalogue is unavailable right now." },
      { status: 503 },
    );
  }
}

const server = Bun.serve({
  port: process.env.PORT || 4000,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/") {
      return new Response("Backend API is running!");
    }
    if (url.pathname === "/api/ai/assistant") {
      if (req.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }
      return handleAssistant(req);
    }
    if (url.pathname === "/api/ai/knowledge/ask") {
      if (req.method !== "POST") {
        return new Response("Method Not Allowed", {
          status: 405,
          headers: { Allow: "POST" },
        });
      }
      return handleKnowledgeAsk(req);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Backend server running on http://localhost:${server.port}`);
