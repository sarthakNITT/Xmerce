/**
 * Ask the knowledge assistant from the terminal.
 *
 *   bun run ask "Can I return an opened laptop I bought online?"
 */
import { askKnowledge } from "../chain";
import { closeClient } from "../store/vector-store";

const question = process.argv.slice(2).join(" ").trim();
if (!question) {
  console.error('Usage: bun run ask "<question>"');
  process.exit(1);
}

const started = Date.now();
const answer = await askKnowledge({ question });
console.log(JSON.stringify(answer, null, 2));
console.log(`(${Date.now() - started} ms)`);
await closeClient();
