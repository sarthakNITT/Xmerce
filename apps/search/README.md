# search (Meilisearch)

Runs the open-source [Meilisearch](https://www.meilisearch.com) engine on `http://127.0.0.1:7700` for product search.
`bun run dev` at the repo root starts it together with the other apps.

Install the binary once: `brew install meilisearch` (macOS) — see meilisearch.com/docs for other platforms.

The backend (`apps/backend`) creates and fills the `products` index from Postgres on startup and keeps it
in sync whenever products or stock change. Set `MEILI_HOST` / `MEILI_MASTER_KEY` in `apps/backend/.env`
to point at another instance.
