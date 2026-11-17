import { RunnableLambda, RunnableSequence } from "@langchain/core/runnables";
import { config } from "./config";
import { generateAnswer, isFollowUp } from "./generate/answer";
import { retrieve } from "./retrieve/retriever";
import {
  KnowledgeAnswerSchema,
  type Audience,
  type KnowledgeAnswer,
  type RetrievedChunk,
} from "./types";

/** One earlier question from the same conversation. */
export interface HistoryTurn {
  question: string;
  /** Title of the document that answered it, if any. */
  document?: string;
}

export interface AskInput {
  question: string;
  /** Defaults to "Customer"; staff-only documents need "Staff". */
  audience?: Audience;
  /** Earlier questions in this conversation, oldest first. */
  history?: HistoryTurn[];
}

interface Retrieved extends AskInput {
  chunks: RetrievedChunk[];
  /** Earlier questions to read the question with; empty unless a follow-up. */
  earlierQuestions: string[];
}

/** How many earlier questions the model is shown for a follow-up. */
const CONTEXT_TURNS = 3;

/** Union of two result lists, keeping each chunk's better score. */
export function mergeChunks(
  a: RetrievedChunk[],
  b: RetrievedChunk[],
  limit: number,
): RetrievedChunk[] {
  const best = new Map<string, RetrievedChunk>();
  for (const chunk of [...a, ...b]) {
    const key = `${chunk.metadata.documentId}#${chunk.metadata.chunkIndex}`;
    const existing = best.get(key);
    if (!existing || chunk.score > existing.score) best.set(key, chunk);
  }
  return [...best.values()].sort((x, y) => y.score - x.score).slice(0, limit);
}

/**
 * NS-I7: short conversation context. The answer model cannot rewrite a
 * follow-up ("what about laptops") into a full question, so instead:
 *
 * 1. Search with the message as written. A strong match means it stands on
 *    its own, and the history is ignored.
 * 2. Otherwise ask the model whether it is a follow-up to the last question.
 * 3. If it is, search again with the previous answer's document as context
 *    ("Warranty Policy: what about laptops") and merge both result lists.
 */
const retrieveStep = RunnableLambda.from<AskInput, Retrieved>(async (input) => {
  const { question, audience } = input;
  const history = input.history ?? [];
  let chunks = await retrieve(question, { audience });
  let earlierQuestions: string[] = [];

  const last = history[history.length - 1];
  const standsAlone = (chunks[0]?.score ?? 0) >= config.highScore;
  if (last && !standsAlone) {
    let followUp = false;
    try {
      followUp = await isFollowUp(last.question, question);
    } catch (error) {
      // Model unreachable: carry on without context; the answer step reports it.
      console.error("[rag] follow-up check failed:", error);
    }
    if (followUp) {
      const contextual = last.document
        ? `${last.document}: ${question}`
        : `${question} (${last.question})`;
      chunks = mergeChunks(
        chunks,
        await retrieve(contextual, { audience }),
        config.topK,
      );
      earlierQuestions = history.slice(-CONTEXT_TURNS).map((turn) => turn.question);
    }
  }
  return { ...input, chunks, earlierQuestions };
});

const answerStep = RunnableLambda.from<Retrieved, KnowledgeAnswer>(
  async ({ question, chunks, earlierQuestions }) =>
    // Validate before anything leaves the pipeline.
    KnowledgeAnswerSchema.parse(
      await generateAnswer(question, chunks, earlierQuestions),
    ),
);

/** question -> retrieve evidence -> answer from that evidence only. */
export const knowledgeChain = RunnableSequence.from<AskInput, KnowledgeAnswer>([
  retrieveStep,
  answerStep,
]);

export function askKnowledge(input: AskInput): Promise<KnowledgeAnswer> {
  const question = input.question.trim();
  if (!question) throw new Error("question must not be empty");
  return knowledgeChain.invoke({ ...input, question });
}
