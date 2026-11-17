# @repo/rag — NovaTech knowledge assistant (AI-B)

Answers customer questions on returns, refunds, delivery, warranty, membership
and the product manual **only from approved documents**, with sources. Built
with LangChain. Covers the MUST requirements NS-I1 to NS-I5.

## Quick start

```bash
# 1. Create .env at the repo root
cp .env.example .env            # then set OPENROUTER_API_KEY and DATABASE_URL

# 2. Index the documents into Neon (from the repo root or packages/rag)
bun run ingest

# 3. Ask
bun run ask "Can I return an opened laptop I bought online?"
```

Through the backend (`bun run dev` in `apps/backend`):

```bash
curl -X POST localhost:4000/api/ai/knowledge/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How long does a refund take?"}'
```

The first run downloads the embedding model (about 130 MB) once.

## How it works

| Step | What happens | Code |
| - | - | - |
| Load | Markdown (metadata in front matter) and PDF (metadata in `<name>.meta.json`) from `data/knowledge/` | `src/ingest/loaders.ts` |
| Chunk | One chunk per section heading; long sections are split with LangChain's `RecursiveCharacterTextSplitter` and keep the heading | `src/ingest/chunker.ts` |
| Embed | `bge-small-en-v1.5` run locally through LangChain's `HuggingFaceTransformersEmbeddings`. No API key, nothing leaves the machine | `src/embed/embeddings.ts` |
| Store | Text, metadata (jsonb) and vector in the Neon Postgres table `rag.document_chunks`, through LangChain's `PGVectorStore` (pgvector) | `src/store/vector-store.ts` |
| Retrieve | Top 4 chunks by cosine similarity. Staff-only documents are filtered out in SQL for customers | `src/retrieve/retriever.ts` |
| Answer | See below | `src/generate/answer.ts` |
| Chain | `retrieve -> answer` as a LangChain `RunnableSequence` | `src/chain.ts` |

### The database

The store is the shared Neon database in `DATABASE_URL`, so everyone on the
team reads the same knowledge base and only one person needs to run
`bun run ingest` after a document changes. The table and the pgvector
extension are created on first use.

The table is in its own Postgres schema, `rag`, not in `public`. The backend's
Prisma tables live in `public`, and `prisma db push` removes tables there that
are not in `schema.prisma`, so keeping the chunks in `rag` keeps them safe.

The connection uses Neon's `@neondatabase/serverless` driver, which talks
Postgres over a WebSocket on port 443. A plain `pg` connection on port 5432
is blocked on some networks (it was on the one this was built on).

### The answer step

The configured model, `perplexity/pplx-decider-flash-v1.3:free` on OpenRouter,
**does not write text**. It only scores questions and points at passages. So
the answer is quoted from the documents instead of being written by a model:

1. If the best chunk scores below `RAG_MIN_SCORE`, return "not found" without
   calling the model.
2. Decisions API, one request with three questions: how completely do the
   excerpts cover the question (not / partly / fully), do they explicitly
   state the answer (yes / no), and which excerpt is the best one. "Not
   covered" or "no" returns "not found". The yes/no question is what catches
   the Thunderbolt 5 dock: a related section exists but does not say.
3. Extractions API: which sentences answer it? Each passage is mapped back to
   its chunk and widened to the full sentence. A passage that is not in the
   retrieved text is dropped. This model often returns no passage at all; the
   answer is then the section picked as best in step 2, quoted whole.
4. Confidence is set in code: fully covered and score at or above
   `RAG_HIGH_SCORE` is HIGH; fully covered below that is MEDIUM; partly
   covered is LOW. Anything other than HIGH sets `followUpRequired`.

If OpenRouter is unreachable or the key is missing, the response has
`status: "UNAVAILABLE"` and lists the closest policy sections.

To use a chat model that writes its own sentences instead, replace
`generateAnswer` in `src/generate/answer.ts`; nothing else needs to change.

## Response

```json
{
  "answer": "Opened laptops and desktops can be returned within 7 days of delivery if there is no physical damage and all accessories and the original box are included.",
  "confidence": "HIGH",
  "sources": [
    { "document": "Laptop & Desktop Return Policy", "section": "Opened products", "version": "2026.1", "score": 0.801 }
  ],
  "followUpRequired": false,
  "status": "ANSWERED",
  "nextStep": null
}
```

`status` is `ANSWERED`, `NOT_FOUND` or `UNAVAILABLE`. `nextStep` offers the
support ticket whenever a follow-up is needed.

## Adding or changing a document

Add a `.md` file with front matter, or a `.pdf` with a `.meta.json` next to
it, to `data/knowledge/`, then run `bun run ingest` again. Re-ingesting a file
replaces its old chunks. Required metadata: `title`, `docType`, `version`,
`effectiveDate`, `region`, `productCategory`, `audience`, `tier`.

`bun run generate:pdf` rebuilds the sample user guide PDF.

## Thresholds

`RAG_MIN_SCORE=0.65` and `RAG_HIGH_SCORE=0.78` were set from the scores of the
acceptance questions with this embedding model: answerable questions score
0.79 to 0.93, unanswerable ones 0.39 to 0.60. Run `bun scripts/calibrate.ts`
to print the scores again after changing documents or the embedding model.

## Follow-up questions

Send the earlier questions of the conversation as `history` and a follow-up
such as "what about laptops" is understood (NS-I7):

```json
{
  "question": "what about laptops",
  "history": [
    { "question": "What is the warranty on the battery and charger?", "document": "Warranty Policy" }
  ]
}
```

The answer model cannot rewrite a follow-up into a full question, so
`src/chain.ts` does this instead: if the message alone has no strong match,
the model is asked whether it depends on the previous question; if so, the
search runs again with the previous answer's document as context and both
result lists are merged. The server keeps no conversation state; the client
sends the history each time.

## Not built yet

Still open from Module I: tier, region, category and effective-date filters
(NS-I6; only the audience filter exists), treating "this laptop" as the
product being viewed (the other half of NS-I7), the admin screen and upload
API (NS-I8), and logging each request to `AiInteraction`. The response still
carries `nextStep` for a support ticket, but there is no ticket API and the
web page does not show a button for it.

## Tests

```bash
bun test
```

The answer step is tested against a mocked OpenRouter, so the tests need no
key or network.
