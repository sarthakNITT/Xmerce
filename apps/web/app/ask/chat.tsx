"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import styles from "./ask.module.css";
import {
  isKnowledgeAnswer,
  type Confidence,
  type KnowledgeAnswer,
} from "./types";

const MAX_QUESTION_LENGTH = 1000;

const SUGGESTIONS = [
  "Can I return an opened laptop I bought online?",
  "How long does a refund take?",
  "Does Gold membership include free express delivery?",
  "Does the warranty cover liquid damage?",
  "How do I reset the NovaBook Air 14?",
];

interface Exchange {
  id: number;
  question: string;
  /** Undefined while the answer is loading. */
  answer?: KnowledgeAnswer;
}

/** Shown when the assistant cannot be reached at all. */
const OFFLINE_ANSWER: KnowledgeAnswer = {
  answer:
    "The knowledge assistant is unavailable right now. Please try again in a moment.",
  confidence: "LOW",
  sources: [],
  followUpRequired: true,
  status: "UNAVAILABLE",
  nextStep: null,
};

/** The conversation is kept for this browser tab, so a reload does not lose it. */
const STORAGE_KEY = "novatech-ask-conversation";

function loadConversation(): Exchange[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is Exchange =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Exchange).id === "number" &&
        typeof (item as Exchange).question === "string" &&
        isKnowledgeAnswer((item as Exchange).answer),
    );
  } catch {
    return [];
  }
}

function saveConversation(exchanges: Exchange[]) {
  try {
    const answered = exchanges.filter((exchange) => exchange.answer);
    if (answered.length === 0) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(answered));
  } catch {
    // Storage can be unavailable (private mode); the chat still works.
  }
}

/**
 * Earlier questions go with each request, so a follow-up such as
 * "what about laptops" is read in the context of the one before it.
 */
function toHistory(exchanges: Exchange[]) {
  return exchanges
    .filter((exchange) => exchange.answer)
    .slice(-6)
    .map((exchange) => ({
      question: exchange.question,
      document: exchange.answer?.sources[0]?.document,
    }));
}

async function ask(
  question: string,
  history: ReturnType<typeof toHistory>,
): Promise<KnowledgeAnswer> {
  try {
    const response = await fetch("/api/knowledge/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question, history }),
    });
    const data: unknown = await response.json();
    return isKnowledgeAnswer(data) ? data : OFFLINE_ANSWER;
  } catch {
    return OFFLINE_ANSWER;
  }
}

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  HIGH: "High confidence",
  MEDIUM: "Medium confidence",
  LOW: "Low confidence",
};

function confidenceClass(confidence: Confidence): string {
  if (confidence === "HIGH") return styles.badgeHigh ?? "";
  if (confidence === "MEDIUM") return styles.badgeMedium ?? "";
  return styles.badgeLow ?? "";
}

function AnswerCard({
  exchange,
  selected,
  onSelect,
}: {
  exchange: Exchange;
  selected: boolean;
  onSelect: () => void;
}) {
  const { answer } = exchange;

  if (!answer) {
    return (
      <div className={styles.answer} role="status">
        <span className={styles.loading}>
          Searching the approved documents
          <span className={styles.dots} aria-hidden="true" />
        </span>
      </div>
    );
  }

  const answered = answer.status === "ANSWERED";
  return (
    <div
      className={`${styles.answer} ${answered ? "" : styles.answerMuted} ${selected ? styles.answerSelected : ""}`}
    >
      <p className={styles.answerText}>{answer.answer}</p>

      <div className={styles.meta}>
        {answered ? (
          <span className={`${styles.badge} ${confidenceClass(answer.confidence)}`}>
            {CONFIDENCE_LABEL[answer.confidence]}
          </span>
        ) : (
          <span className={`${styles.badge} ${styles.badgeLow}`}>
            {answer.status === "NOT_FOUND" ? "Not in the documents" : "Unavailable"}
          </span>
        )}
        {answer.followUpRequired && (
          <span className={`${styles.badge} ${styles.badgeFollowUp}`}>
            Follow-up recommended
          </span>
        )}
        {answer.sources.length > 0 && (
          <button
            type="button"
            className={styles.sourceToggle}
            onClick={onSelect}
            aria-pressed={selected}
          >
            {answer.sources.length === 1
              ? "1 source"
              : `${answer.sources.length} sources`}
          </button>
        )}
      </div>

      {answer.status === "NOT_FOUND" && (
        <p className={styles.redirect}>
          Looking for a product? This page only answers policy questions.{" "}
          <Link href={`/assistant?q=${encodeURIComponent(exchange.question)}`}>
            Ask the shopping assistant instead
          </Link>
        </p>
      )}

      {answer.sources.length > 0 && (
        <ol className={styles.chips} aria-label="Sources for this answer">
          {answer.sources.map((source, i) => (
            <li key={`${source.document}-${source.section}`} className={styles.chip}>
              <span className={styles.chipNumber}>{i + 1}</span>
              {source.document}, {source.section}
            </li>
          ))}
        </ol>
      )}

    </div>
  );
}

function SourcesPanel({ exchange }: { exchange: Exchange | undefined }) {
  const sources = exchange?.answer?.sources ?? [];
  return (
    <aside className={styles.sources} aria-label="Sources">
      <h2 className={styles.sourcesTitle}>Sources</h2>
      {!exchange?.answer ? (
        <p className={styles.sourcesEmpty}>
          The documents behind each answer appear here.
        </p>
      ) : sources.length === 0 ? (
        <p className={styles.sourcesEmpty}>
          No approved document covers this question.
        </p>
      ) : (
        <>
          <p className={styles.sourcesFor}>For: {exchange.question}</p>
          <ol className={styles.sourceList}>
            {sources.map((source, i) => {
              const percent = Math.round(source.score * 100);
              return (
                <li key={`${source.document}-${source.section}`} className={styles.source}>
                  <span className={styles.chipNumber}>{i + 1}</span>
                  <div className={styles.sourceBody}>
                    <p className={styles.sourceDocument}>{source.document}</p>
                    <p className={styles.sourceSection}>
                      {source.section} · version {source.version}
                    </p>
                    <div className={styles.match}>
                      <div
                        className={styles.matchBar}
                        role="meter"
                        aria-label="Match score"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={percent}
                      >
                        <span style={{ width: `${percent}%` }} />
                      </div>
                      <span className={styles.matchValue}>{percent}% match</span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </aside>
  );
}

export function Chat() {
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [selectedId, setSelectedId] = useState<number | undefined>();
  const [draft, setDraft] = useState("");
  const nextId = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);

  const busy = exchanges.some((exchange) => !exchange.answer);

  // Restore the conversation after the first render (the server has none).
  const restored = useRef(false);
  useEffect(() => {
    const saved = loadConversation();
    if (saved.length > 0) {
      nextId.current = Math.max(...saved.map((exchange) => exchange.id)) + 1;
      setExchanges(saved);
    }
    restored.current = true;
  }, []);

  useEffect(() => {
    if (restored.current) saveConversation(exchanges);
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [exchanges]);

  function clearConversation() {
    setExchanges([]);
    setSelectedId(undefined);
  }

  async function submit(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const id = nextId.current++;
    const history = toHistory(exchanges);
    setExchanges((current) => [...current, { id, question }]);
    setSelectedId(id);
    setDraft("");
    const answer = await ask(question, history);
    setExchanges((current) =>
      current.map((exchange) =>
        exchange.id === id ? { ...exchange, answer } : exchange,
      ),
    );
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void submit(draft);
  }

  const selected =
    exchanges.find((exchange) => exchange.id === selectedId) ??
    exchanges[exchanges.length - 1];

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.brand}>NovaTech</p>
        <h1 className={styles.title}>Ask NovaTech</h1>
        <p className={styles.subtitle}>
          Answers on returns, refunds, delivery, warranty and membership, taken
          only from our approved documents.
        </p>
        <nav className={styles.nav} aria-label="Assistants">
          <Link href="/assistant">Shopping assistant</Link>
          <span aria-current="page">Ask about policies</span>
        </nav>
      </header>

      <div className={styles.layout}>
        <section className={styles.chat} aria-label="Conversation">
          <div className={styles.messages} aria-live="polite">
            {exchanges.length === 0 ? (
              <div className={styles.empty}>
                <p className={styles.emptyTitle}>What would you like to know?</p>
                <ul className={styles.suggestions}>
                  {SUGGESTIONS.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        className={styles.suggestion}
                        onClick={() => void submit(suggestion)}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              exchanges.map((exchange) => (
                <div key={exchange.id} className={styles.exchange}>
                  <p className={styles.question}>{exchange.question}</p>
                  <AnswerCard
                    exchange={exchange}
                    selected={exchange.id === selected?.id}
                    onSelect={() => setSelectedId(exchange.id)}
                  />
                </div>
              ))
            )}
            <div ref={endRef} />
          </div>

          <form className={styles.form} onSubmit={onSubmit}>
            <label htmlFor="question" className={styles.srOnly}>
              Your question
            </label>
            <input
              id="question"
              className={styles.input}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask about returns, delivery, warranty or membership"
              maxLength={MAX_QUESTION_LENGTH}
              autoComplete="off"
            />
            <button
              type="submit"
              className={styles.send}
              disabled={busy || draft.trim() === ""}
            >
              {busy ? "Asking" : "Ask"}
            </button>
          </form>
          <div className={styles.footer}>
            <p className={styles.hint}>
              You can ask follow-ups such as &ldquo;what about laptops?&rdquo;.
              Do not include personal details such as your email or phone
              number.
            </p>
            {exchanges.length > 0 && (
              <button
                type="button"
                className={styles.clear}
                onClick={clearConversation}
                disabled={busy}
              >
                New conversation
              </button>
            )}
          </div>
        </section>

        <SourcesPanel exchange={selected} />
      </div>
    </div>
  );
}
