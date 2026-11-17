# AI-A shopping assistant: guardrails

Every rule below is enforced in code. The prompt is never the only thing
standing between the model and a wrong answer. File paths are relative to
`packages/assistant/` unless they start with another folder.

## What the model is allowed to do

The model (Perplexity Decider on OpenRouter) cannot write text or call tools.
It does three things: choose the product category from the real category
list, answer yes/no questions about the message (was a use stated, does
battery life matter), and score candidate products against the need. Budget,
RAM, storage, weight and brand are read by rules. Every sentence the shopper
sees is written by code from catalogue data.

## Guardrails

| # | Guardrail | Enforced in | How |
| - | - | - | - |
| 1 | Product data is reached only through predefined tools; the model has no SQL access | `src/tools.ts` `searchProducts`, `getProduct` | The service calls these two functions and nothing else. They call `getCandidates` and `getProduct` in `packages/catalogue/src/catalogue.ts`, which are fixed Prisma queries. |
| 2 | Filters run in the database, not in the prompt | `packages/catalogue/src/catalogue.ts` `getCandidates` | Category, price, RAM, storage, weight and brand are `WHERE` conditions of the Prisma query. |
| 3 | The budget is the one the shopper stated | `src/budget.ts` `parseBudget`; `src/service.ts` `runAssistant` | A regex reads the budget from the message and wins over the model's value. |
| 4 | A search can never use a different budget | `src/tools.ts` `enforceBudget` | Overwrites `maxPrice` with the extracted budget and forces `ignoreBudget` off before the query runs. Only the "nothing matches" step may switch it on. |
| 5 | No recommendation over budget unless it says so | `src/service.ts` `validatePicks`, `toRecommendation` | `aboveBudget` is computed as `price > budget`; anything over budget and not marked is dropped. |
| 6 | Only real products | `src/service.ts` `validatePicks` | A pick whose `productId` is not in the candidate list is dropped. If every pick is invented, ranking falls back to rules. |
| 7 | Price, SKU and availability never come from the model | `src/service.ts` `toRecommendation` | Copied from the catalogue row of the chosen variant. |
| 8 | Availability is live | `packages/catalogue/src/availability.ts` `availabilityOf` | Computed from the variant's stock on every request (0 out of stock, 1 to 5 low, more in stock); never stored. |
| 9 | Reasons cite only real specifications | `src/reasons.ts` `isGrounded`, `templateReason` | Every number with a unit (GB, TB, hr, kg, Hz, inch) and every rupee amount in a model-written reason must match the product. One mismatch and the reason is replaced by one built from the catalogue. The current model writes no reasons, so all reasons are built this way. |
| 10 | Missing information is asked for, not guessed | `src/service.ts` `clarifyingQuestion` | If the category, budget or use is missing, the question is returned and no search runs. |
| 11 | Nothing matches: say so, never invent | `src/service.ts` `runAssistant` (step 5) | Zero results triggers a second search without the price limit; the two cheapest are returned marked above budget, with a fixed message. Zero again returns "we don't have that". |
| 12 | Out-of-stock picks are marked and paired with something buyable | `src/service.ts` `validatePicks` | An `OUT_OF_STOCK` pick stays, and the best in-stock alternative is added after it. |
| 13 | Only real categories and brands | `src/service.ts` `runAssistant`; `src/rules.ts` `brandFromText` | A category not in the database is treated as not stated. A brand counts only if the catalogue sells it. |
| 14 | Every model output is schema-checked | `src/service.ts` `callValidated`; `src/contract.ts`; `src/llm.ts` `LlmExtractionSchema` | zod validation; one retry with the validation error; then fallback. |
| 15 | The response always matches the contract | `src/service.ts` `runAssistant` (`finish`); `src/contract.ts` `AssistantResponseSchema` | The final object is parsed with a strict zod schema before it is returned. |
| 16 | The model failing never fails the request | `src/service.ts` `runAssistant`, `callValidated`; `src/rules.ts` `extractByRules`, `rankByRules` | Model off (`AI_ENABLED=false`), down, slow (9 s total, `AI_TIMEOUT_MS`) or invalid twice: rules extract the request and rank the same search results, with `mode: "fallback"`. |
| 17 | No personal data reaches the model or the log | `src/privacy.ts` `maskSensitive`; `src/service.ts` `runAssistant` | Emails, phone numbers and card numbers are masked first. Saved preferences carry only budget, use and brand. |
| 18 | Text in the message is data, not instructions | `src/llm.ts` `DATA_ONLY` | Stated in every question to the model. It is also true by construction: the model can only choose, answer yes/no and score, so it has nothing to be talked into saying. |
| 19 | Saved preferences never override the shopper | `src/service.ts` `runAssistant` | Preferences are used only where the message gave nothing. |
| 20 | Every request is logged | `src/log.ts` `logInteraction` | Module, masked question, response, latency and mode are appended to `logs/ai-interactions.jsonl`. There is no `ai_interaction` table in this database. |

## Tests

`packages/assistant/tests/assistant.test.ts` covers each guardrail with a
mocked model and an in-memory copy of the seed catalogue (no network, no
database): `bun test` in `packages/assistant`.
