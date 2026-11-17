/**
 * Prints the retrieval scores for the acceptance questions, to set
 * RAG_MIN_SCORE and RAG_HIGH_SCORE for the embedding model in use.
 *
 *   bun scripts/calibrate.ts
 */
import { retrieve } from "../src/retrieve/retriever";
import { closeClient } from "../src/store/vector-store";

const QUESTIONS: { question: string; expected: string }[] = [
  { question: "Can I return an opened laptop I bought online?", expected: "Return Policy / Opened products" },
  { question: "How long does a refund take?", expected: "Refund Policy / Timelines" },
  { question: "Does Gold membership include free express delivery?", expected: "NovaClub / Gold tier" },
  { question: "Does the warranty cover liquid damage?", expected: "Warranty / Liquid and accidental damage" },
  { question: "How do I reset the NovaBook Air 14?", expected: "User Guide / Reset this PC" },
  { question: "How much does express delivery cost?", expected: "Shipping / Express delivery" },
  { question: "Can I use two coupons on one order?", expected: "Coupon / General rules" },
  { question: "Is the NovaBook Air 14 compatible with a Thunderbolt 5 dock?", expected: "(not covered)" },
  { question: "What discount cap do the agents have?", expected: "(staff only: must not be retrieved)" },
  { question: "What is the capital of France?", expected: "(off topic)" },
  { question: "Do you sell smartphones?", expected: "(off topic)" },
];

for (const { question, expected } of QUESTIONS) {
  const chunks = await retrieve(question);
  console.log(`\nQ: ${question}\n   expected: ${expected}`);
  for (const chunk of chunks) {
    console.log(
      `   ${chunk.score.toFixed(3)}  ${chunk.metadata.title} / ${chunk.metadata.section}`,
    );
  }
}
await closeClient();
