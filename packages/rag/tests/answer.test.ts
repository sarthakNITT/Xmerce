import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { mergeChunks } from "../src/chain";
import {
  confidenceFor,
  generateAnswer,
  isFollowUp,
  maskPersonalData,
} from "../src/generate/answer";
import {
  KnowledgeAnswerSchema,
  type ChunkMetadata,
  type RetrievedChunk,
} from "../src/types";

function chunk(
  title: string,
  section: string,
  body: string,
  score: number,
): RetrievedChunk {
  const metadata: ChunkMetadata = {
    title,
    docType: "Policy",
    version: "2026.1",
    effectiveDate: "2026-01-01",
    region: "India",
    productCategory: "Laptop",
    audience: "Customer",
    tier: "All",
    documentId: `${title}@2026.1`,
    sourceFile: `${title}.md`,
    section,
    chunkIndex: section.length,
  };
  return { text: `${title} — ${section}\n${body}`, metadata, score };
}

const OPENED =
  "Opened laptops and desktops can be returned within 7 days of delivery if there is no physical damage and all accessories and the original box are included. The 7 days are counted from the delivery date shown in My Orders.";
const UNOPENED = "Unopened products can be returned within 15 days of delivery.";

const chunks = [
  chunk("Laptop & Desktop Return Policy", "Opened products", OPENED, 0.8),
  chunk("Laptop & Desktop Return Policy", "Unopened products", UNOPENED, 0.72),
];

const realFetch = globalThis.fetch;
const realKey = process.env.OPENROUTER_API_KEY;

/** Stand in for OpenRouter: one canned reply per route. */
function mockOpenRouter(replies: {
  decisions?: object | number;
  extractions?: object | number;
}) {
  const calls: { route: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
    const route = String(url).includes("/alpha/decisions") ? "decisions" : "extractions";
    calls.push({ route, body: JSON.parse(String(init?.body)) });
    const reply = replies[route];
    if (typeof reply === "number") return new Response("error", { status: reply });
    return Response.json({ answers: reply ?? {} });
  }) as unknown as typeof fetch;
  return calls;
}

const covered = (score: number, choice = "S1", answered = score >= 0.5 ? 0.95 : 0.03) => ({
  coverage: { type: "score", score },
  answered: { type: "noul", noul: answered },
  source: { type: "choice", choice },
});

beforeEach(() => {
  process.env.OPENROUTER_API_KEY = "test-key";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realKey === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = realKey;
});

describe("generateAnswer", () => {
  test("strong evidence: quotes the document, HIGH, with source and version", async () => {
    mockOpenRouter({
      decisions: covered(1.9),
      // The model points at a fragment; the answer widens it to the sentence.
      extractions: {
        answer: { type: "list", value: ["within 7 days of delivery"], spans: [[40, 65]] },
      },
    });
    const answer = await generateAnswer("Can I return an opened laptop?", chunks);

    expect(KnowledgeAnswerSchema.safeParse(answer).success).toBe(true);
    expect(answer.status).toBe("ANSWERED");
    expect(answer.confidence).toBe("HIGH");
    expect(answer.followUpRequired).toBe(false);
    expect(answer.answer).toBe(
      "Opened laptops and desktops can be returned within 7 days of delivery if there is no physical damage and all accessories and the original box are included.",
    );
    expect(answer.sources).toEqual([
      {
        document: "Laptop & Desktop Return Policy",
        section: "Opened products",
        version: "2026.1",
        score: 0.8,
      },
    ]);
  });

  test("the answer is always text from the documents, never the model's own words", async () => {
    mockOpenRouter({
      decisions: covered(1.9),
      // A passage that is not in the excerpts, and comes without offsets.
      extractions: { answer: { type: "list", value: ["Returns are accepted for 90 days."] } },
    });
    const answer = await generateAnswer("Can I return an opened laptop?", chunks);
    expect(answer.answer).not.toContain("90 days");
    expect(OPENED).toContain(answer.answer.split(". ")[0] ?? "");
    expect(answer.confidence).toBe("MEDIUM");
  });

  test("the model points at no passage: quotes the section it picked, still HIGH", async () => {
    mockOpenRouter({
      decisions: covered(1.96),
      extractions: { answer: { type: "list", value: null } },
    });
    const answer = await generateAnswer("Can I return an opened laptop?", chunks);
    expect(answer.answer).toBe(OPENED);
    expect(answer.confidence).toBe("HIGH");
    expect(answer.sources[0]?.section).toBe("Opened products");
  });

  test("a related section that does not state the answer is not found", async () => {
    // Seen live: "partly covered" on the scale, but "not answered" as yes/no.
    mockOpenRouter({ decisions: covered(0.58, "S1", 0.02) });
    const answer = await generateAnswer("Is it compatible with a Thunderbolt 5 dock?", chunks);
    expect(answer.status).toBe("NOT_FOUND");
    expect(answer.sources).toEqual([]);
  });

  test("weak evidence: LOW confidence and a follow-up", async () => {
    mockOpenRouter({
      decisions: covered(1.0),
      extractions: { answer: { type: "list", value: [UNOPENED], spans: [[OPENED.length + 2, OPENED.length + 2 + UNOPENED.length]] } },
    });
    const answer = await generateAnswer("Can I return it after two weeks?", chunks);
    expect(answer.confidence).toBe("LOW");
    expect(answer.followUpRequired).toBe(true);
    expect(answer.sources[0]?.section).toBe("Unopened products");
    expect(answer.nextStep?.type).toBe("SUPPORT_TICKET");
  });

  test("the model says the excerpts do not cover it: not found, no guess", async () => {
    const calls = mockOpenRouter({ decisions: covered(0.1, "none") });
    const answer = await generateAnswer("Is it compatible with a Thunderbolt 5 dock?", chunks);
    expect(answer.status).toBe("NOT_FOUND");
    expect(answer.sources).toEqual([]);
    expect(answer.followUpRequired).toBe(true);
    expect(answer.answer).toContain("contact NovaTech support");
    expect(calls.map((call) => call.route)).toEqual(["decisions"]);
  });

  test("nothing above the similarity threshold: not found without calling the model", async () => {
    const calls = mockOpenRouter({ decisions: covered(2) });
    const answer = await generateAnswer("What is the capital of France?", [
      chunk("Refund Policy", "Timelines", "Refunds take 5 to 7 business days.", 0.39),
    ]);
    expect(answer.status).toBe("NOT_FOUND");
    expect(calls).toHaveLength(0);
  });

  test("a refused or missing verdict fails closed", async () => {
    mockOpenRouter({ decisions: { coverage: { type: "refusal" } } });
    const answer = await generateAnswer("Can I return an opened laptop?", chunks);
    expect(answer.status).toBe("NOT_FOUND");
  });

  test("model unavailable: friendly fallback that still validates", async () => {
    mockOpenRouter({ decisions: 503 });
    const answer = await generateAnswer("Can I return an opened laptop?", chunks);
    expect(KnowledgeAnswerSchema.safeParse(answer).success).toBe(true);
    expect(answer.status).toBe("UNAVAILABLE");
    expect(answer.followUpRequired).toBe(true);
    expect(answer.sources).toHaveLength(2);
  });

  test("no API key: same fallback", async () => {
    delete process.env.OPENROUTER_API_KEY;
    const answer = await generateAnswer("Can I return an opened laptop?", chunks);
    expect(answer.status).toBe("UNAVAILABLE");
  });

  test("personal data is masked before it is sent", async () => {
    const calls = mockOpenRouter({ decisions: covered(0, "none") });
    await generateAnswer("I am anita.rao@example.com, phone 98765 43210. Can I return it?", chunks);
    const sent = JSON.stringify(calls[0]?.body);
    expect(sent).not.toContain("anita.rao@example.com");
    expect(sent).not.toContain("98765");
  });
});

describe("helpers", () => {
  test("confidence comes from the verdict and the similarity score", () => {
    expect(confidenceFor("FULL", 0.85)).toBe("HIGH");
    expect(confidenceFor("FULL", 0.7)).toBe("MEDIUM");
    expect(confidenceFor("PARTIAL", 0.85)).toBe("LOW");
  });

  test("maskPersonalData leaves ordinary numbers alone", () => {
    expect(maskPersonalData("Is INR 70,000 enough for 2 laptops?")).toBe(
      "Is INR 70,000 enough for 2 laptops?",
    );
  });
});

describe("follow-up questions", () => {
  test("earlier questions are shown to the model with the follow-up", async () => {
    const calls = mockOpenRouter({
      decisions: covered(1.9),
      extractions: { answer: { type: "list", value: null } },
    });
    await generateAnswer("what about unopened ones?", chunks, [
      "Can I return an opened laptop?",
    ]);
    const state = String(calls[0]?.body.state);
    expect(state).toContain("EARLIER QUESTIONS FROM THE SAME CUSTOMER");
    expect(state).toContain("- Can I return an opened laptop?");
    expect(JSON.stringify(calls[1]?.body.fields)).toContain(
      "a follow-up to: Can I return an opened laptop?",
    );
  });

  test("isFollowUp reads the model's yes/no verdict and fails closed", async () => {
    mockOpenRouter({ decisions: { followUp: { type: "noul", noul: 0.94 } } });
    expect(await isFollowUp("Battery warranty?", "what about laptops")).toBe(true);
    mockOpenRouter({ decisions: { followUp: { type: "noul", noul: 0.01 } } });
    expect(await isFollowUp("Battery warranty?", "How do I reset it?")).toBe(false);
    mockOpenRouter({ decisions: { followUp: { type: "refusal" } } });
    expect(await isFollowUp("Battery warranty?", "what about laptops")).toBe(false);
  });

  test("mergeChunks keeps each chunk once, with its better score", () => {
    const a = [chunks[0]!, chunks[1]!];
    const b = [{ ...chunks[1]!, score: 0.9 }];
    const merged = mergeChunks(a, b, 4);
    expect(merged.map((c) => [c.metadata.section, c.score])).toEqual([
      ["Opened products", 0.8],
      ["Unopened products", 0.9],
    ].sort((x, y) => (y[1] as number) - (x[1] as number)));
  });
});
