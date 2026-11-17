#!/bin/sh
# Starts Meilisearch for local dev. If one is already running on 7700
# (e.g. started separately), reuse it instead of failing the whole turbo run.
ADDR="127.0.0.1:7700"
if curl -s -m 2 "http://$ADDR/health" | grep -q available; then
  echo "Meilisearch already running at http://$ADDR — reusing it."
  # Stay alive so turbo keeps the persistent task running; exit cleanly on Ctrl+C.
  trap 'exit 0' INT TERM
  while :; do sleep 3600 & wait $!; done
fi
if ! command -v meilisearch >/dev/null 2>&1; then
  echo "meilisearch is not installed. Install it with: brew install meilisearch"
  exit 1
fi
exec meilisearch --db-path ./data.ms --http-addr "$ADDR" --env development --no-analytics
