"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./assistant.module.css";
import { ProductQuickView } from "../../components/ProductQuickView";
import {
  isAssistantResponse,
  type AssistantResponse,
  type Availability,
  type Recommendation,
} from "./types";

const MAX_MESSAGE_LENGTH = 1000;

const EXAMPLES = [
  "I need a laptop under INR 70,000 for coding and light video editing. Battery life matters; I travel a lot.",
  "Suggest a desktop for my home office under INR 60,000.",
  "Show me a gaming laptop under INR 1,00,000.",
  "I need a good laptop.",
];

interface Turn {
  id: number;
  /** What the shopper typed. */
  text: string;
  /** Undefined while loading; null when the assistant could not be reached. */
  response?: AssistantResponse | null;
}

const inr = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

const AVAILABILITY: Record<Availability, { label: string; className: string }> = {
  IN_STOCK: { label: "In stock", className: styles.inStock ?? "" },
  LOW_STOCK: { label: "Low stock", className: styles.lowStock ?? "" },
  OUT_OF_STOCK: { label: "Out of stock", className: styles.outOfStock ?? "" },
};

async function ask(message: string): Promise<AssistantResponse | null> {
  try {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data: unknown = await response.json();
    return isAssistantResponse(data) ? data : null;
  } catch {
    return null;
  }
}

function ProductCard({ product, onOpen }: { product: Recommendation; onOpen: (productId: string) => void }) {
  const availability = AVAILABILITY[product.availability];
  return (
    <li
      className={styles.card}
      role="button"
      tabIndex={0}
      aria-label={`View details for ${product.productName}`}
      style={{ cursor: "pointer" }}
      onClick={() => onOpen(product.productId)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(product.productId);
        }
      }}
    >
      <div className={styles.cardHead}>
        <h3 className={styles.productName}>{product.productName}</h3>
        <p className={styles.price}>{inr(product.price)}</p>
      </div>
      <p className={styles.reason}>{product.reason}</p>
      <div className={styles.badges}>
        <span className={`${styles.badge} ${availability.className}`}>
          {availability.label}
        </span>
        {product.aboveBudget && (
          <span className={`${styles.badge} ${styles.aboveBudget}`}>Above budget</span>
        )}
        <span className={styles.sku}>{product.sku}</span>
      </div>
    </li>
  );
}

function AssistantReply({ turn, onOpenProduct }: { turn: Turn; onOpenProduct: (productId: string) => void }) {
  const { response } = turn;
  if (response === undefined) {
    return (
      <div className={styles.reply} role="status">
        <span className={styles.loading}>
          Searching the catalogue
          <span className={styles.dots} aria-hidden="true" />
        </span>
      </div>
    );
  }
  if (response === null) {
    return (
      <div className={styles.reply}>
        <p className={styles.replyText}>
          The shopping assistant is unavailable right now. Please try again in a
          moment.
        </p>
      </div>
    );
  }

  const text = response.clarifyingQuestion ?? response.message;
  return (
    <div className={styles.reply}>
      <ul className={styles.chips} aria-label="What the assistant understood">
        <li className={styles.chip}>
          <span className={styles.chipLabel}>Need</span>
          {response.interpretedRequirement}
        </li>
        <li className={styles.chip}>
          <span className={styles.chipLabel}>Budget</span>
          {response.budget === null ? "Not stated" : inr(response.budget)}
        </li>
      </ul>

      {text && <p className={styles.replyText}>{text}</p>}

      {response.recommendations.length > 0 && (
        <ol className={styles.cards}>
          {response.recommendations.map((product) => (
            <ProductCard key={product.sku} product={product} onOpen={onOpenProduct} />
          ))}
        </ol>
      )}

      {response.mode === "fallback" && (
        <p className={styles.note}>
          The AI ranking was unavailable, so these are standard search results
          for your filters.
        </p>
      )}
    </div>
  );
}

export function Assistant() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [openProductId, setOpenProductId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  /**
   * While the assistant is asking a clarifying question, the shopper's answer
   * is sent together with what they said before, so "under 70k, for coding"
   * still means the laptop they first asked about.
   */
  const pending = useRef("");

  const busy = turns.some((turn) => turn.response === undefined);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function submit(text: string) {
    const typed = text.trim();
    if (!typed || busy) return;
    const id = nextId.current++;
    setTurns((current) => [...current, { id, text: typed }]);
    setDraft("");

    const message = `${pending.current} ${typed}`.trim().slice(-MAX_MESSAGE_LENGTH);
    const response = await ask(message);
    pending.current = response?.clarifyingQuestion ? message : "";
    setTurns((current) =>
      current.map((turn) => (turn.id === id ? { ...turn, response } : turn)),
    );
  }

  // A link such as /assistant?q=laptop+under+70000 (from the policy page)
  // asks that question straight away.
  const prefilled = useRef(false);
  useEffect(() => {
    if (prefilled.current) return;
    prefilled.current = true;
    const question = new URLSearchParams(window.location.search).get("q");
    if (question) {
      window.history.replaceState(null, "", window.location.pathname);
      void submit(question);
    }
    // Runs once on load; `submit` is not a dependency on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(draft);
  }

  function startOver() {
    pending.current = "";
    setTurns([]);
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.brand}>NovaTech</p>
        <h1 className={styles.title}>Shopping assistant</h1>
        <p className={styles.subtitle}>
          Describe what you need in your own words. Every recommendation is a
          real product from our catalogue, with live stock.
        </p>
        <nav className={styles.nav} aria-label="Assistants">
          <span aria-current="page">Shopping assistant</span>
          <Link href="/ask">Ask about policies</Link>
        </nav>
      </header>

      <main className={styles.panel}>
        <div className={styles.turns} aria-live="polite">
          {turns.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Try one of these</p>
              <ul className={styles.examples}>
                {EXAMPLES.map((example) => (
                  <li key={example}>
                    <button
                      type="button"
                      className={styles.example}
                      onClick={() => void submit(example)}
                    >
                      {example}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            turns.map((turn) => (
              <div key={turn.id} className={styles.turn}>
                <p className={styles.shopper}>{turn.text}</p>
                <AssistantReply turn={turn} onOpenProduct={setOpenProductId} />
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <label htmlFor="need" className={styles.srOnly}>
            What you need
          </label>
          <input
            id="need"
            className={styles.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="For example: a light laptop for college under 55k"
            maxLength={MAX_MESSAGE_LENGTH}
            autoComplete="off"
          />
          <button
            type="submit"
            className={styles.send}
            disabled={busy || draft.trim() === ""}
          >
            {busy ? "Searching" : "Find"}
          </button>
        </form>
        <div className={styles.footer}>
          <p className={styles.hint}>
            Include your budget and what you will use it for. Do not include
            personal details such as your email or phone number.
          </p>
          {turns.length > 0 && (
            <button
              type="button"
              className={styles.clear}
              onClick={startOver}
              disabled={busy}
            >
              Start over
            </button>
          )}
        </div>
      </main>
      <ProductQuickView productId={openProductId} onClose={() => setOpenProductId(null)} />
    </div>
  );
}
