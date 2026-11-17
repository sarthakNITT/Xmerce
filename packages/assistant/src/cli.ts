/**
 * Ask the shopping assistant from the terminal.
 *
 *   bun run ask "I need a laptop under INR 70,000 for coding"
 */
import { disconnect } from "@repo/catalogue";
import { runAssistant } from "./service";

const message = process.argv.slice(2).join(" ").trim();
if (!message) {
  console.error('Usage: bun run ask "<what you need>"');
  process.exit(1);
}
const started = Date.now();
try {
  console.log(JSON.stringify(await runAssistant({ message }), null, 2));
  console.log(`(${Date.now() - started} ms)`);
} finally {
  await disconnect();
}
