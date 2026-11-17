# @repo/assistant — NovaTech shopping assistant (AI-A)

Turns a shopper's plain-language need into up to three real catalogue
products, each with a reason and live availability. It asks a question when
the product type, budget or use is missing.

```bash
# from packages/assistant
bun run ask "I need a laptop under INR 70,000 for coding. Battery life matters."

# through the backend
curl -X POST localhost:4000/api/ai/assistant \
  -H "Content-Type: application/json" \
  -d '{"message":"Suggest a desktop for my home office under INR 60,000."}'
```

It needs `OPENROUTER_API_KEY` and `DATABASE_URL` in `.env` at the repo root,
and the catalogue seeded (`packages/catalogue`).

## Pipeline (`src/service.ts`)

1. Mask emails, phone and card numbers (`src/privacy.ts`).
2. Extract: the model picks the category, use and priorities
   (`src/llm.ts`); rules read budget, RAM, storage, weight and brand
   (`src/rules.ts`, `src/budget.ts`). The regex budget wins.
3. Clarify: anything missing returns a question and stops.
4. Search through the tools (`src/tools.ts`), with the budget fixed in code.
5. Nothing matches: search again without the price limit and show the two
   cheapest, marked above budget; or say the product is not sold.
6. Rank: the model scores the candidates.
7. Validate: drop invented products, take price, SKU and stock from the
   catalogue, check or build each reason (`src/reasons.ts`), pair an
   out-of-stock pick with an in-stock one.
8. Fallback to rules whenever the model is off, down, slow or wrong.
9. Log to `logs/ai-interactions.jsonl` (`src/log.ts`).

The full list of rules and where each is enforced is in
[docs/GUARDRAILS-AI-A.md](../../docs/GUARDRAILS-AI-A.md).

## The model

The project's model, Perplexity Decider, cannot write text or call tools. It
chooses, answers yes/no and scores. So reasons and all other wording are
built by code from catalogue data, and the tools are called directly by the
service rather than by the model.

To use a model that writes its own reasons, implement `AssistantLlm` in
`src/llm.ts` and pass it as `deps.llm`. Everything in step 7 already applies
to it: an invented product is dropped and a reason with a wrong number is
replaced. `toolDefinitions()` in `src/tools.ts` gives the tool schemas for a
model that supports tool calling.

## Settings

| Variable | Default | Meaning |
| - | - | - |
| `AI_ENABLED` | `true` | `false` switches the model off; rules do everything |
| `AI_TIMEOUT_MS` | `9000` | Total time the model may take in one request |
| `AI_LOG_DIR` | `<repo>/logs` | Where the interaction log is written |

## Not built

- Saved preferences are supported by the service (`preferences` input) but
  nothing passes them yet, because there is no sign-in on this branch.
- Add to cart and Compare on the product cards: there is no cart API for
  these catalogue SKUs yet.
- Semantic ranking with product embeddings (the optional step).
