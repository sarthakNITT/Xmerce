import React, { useState } from 'react';
import { formatINR } from '../data/products';
import { useProducts } from '../lib/catalog';

interface AiShoppingAssistantProps {
  onAddToCart: (productId: string) => void;
}

export const AiShoppingAssistant: React.FC<AiShoppingAssistantProps> = ({ onAddToCart }) => {
  const PRODUCTS = useProducts();
  const [needText, setNeedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [resultHtml, setResultHtml] = useState<React.ReactNode | null>(null);

  const evaluateBrief = async (text: string) => {
    const q = text.toLowerCase().trim();

    // Deterministic fallback parser helper
    const fallbackParse = () => {
      const match = q.match(/(?:under|below|budget(?:\s+of)?|up to|₹|inr|rs\.?)[\s₹]*(\d[\d,]*(?:\.\d+)?)\s*(k|lakh)?/);
      const rawNum = match && match[1] ? Number(match[1].replace(/,/g, '')) : 0;
      const multiplier = match && match[2] === 'k' ? 1000 : match && match[2] === 'lakh' ? 100000 : 1;
      const b = rawNum * multiplier;
      const cat = q.includes('gaming')
        ? 'Gaming'
        : q.includes('desktop')
        ? 'Desktops'
        : q.includes('all-in-one')
        ? 'All-in-One'
        : q.includes('laptop')
        ? 'Laptops'
        : null;
      return { budget: b, category: cat };
    };

    // Fast check for missing basic constraints
    const hasUse = /coding|travel|gaming|office|study|student|editing|design|work|programming|school/.test(q);
    const hasNumber = /\d+/.test(q);

    if (!hasUse || !hasNumber) {
      setResultHtml(
        <div className="ai-feedback-box is-warning">
          <p className="ai-feedback-msg">
            What is your maximum budget in INR, and what will you mainly use the computer for?
          </p>
          <span className="ai-hint">
            Example: &quot;A laptop under ₹70,000 for coding and travel&quot;
          </span>
        </div>
      );
      return;
    }

    if (/battery|hours|oled|weight|ssd|storage|screen|inch|rtx|touchscreen|linux|mac|video|render|cad/.test(q)) {
      setResultHtml(
        <div className="ai-feedback-box is-info">
          <p className="ai-feedback-msg">
            This local demo cannot reliably evaluate all those constraints. Please use the catalogue filters or compare the listed specifications. The connected shopping service will handle detailed requirements.
          </p>
        </div>
      );
      return;
    }

    setLoading(true);
    let extractedBudget = 0;
    let chosenCategory: string | null = null;
    let decisionConfidence: number | null = null;
    let modelName = 'perplexity/pplx-decider-flash-v1.3:free';

    try {
      // 1. Call OpenRouter Decisions API
      const decisionPromise = fetch('/api/ai/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          state: text,
          questions: {
            category: {
              type: 'choice',
              instructions: 'Which computer hardware category does the customer want?',
              criteria: {
                Laptops: 'Customer wants a laptop or portable computer',
                Desktops: 'Customer wants a desktop tower or workstation',
                Gaming: 'Customer wants gaming laptop or high-performance rig',
                'All-in-One': 'Customer wants an all-in-one desktop',
              },
            },
          },
        }),
      }).then((r) => (r.ok ? r.json() : null));

      // 2. Call OpenRouter Extractions API
      const extractionPromise = fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          state: text,
          fields: {
            budget: {
              type: 'text',
              instructions: 'Maximum spending budget mentioned in the text',
            },
            purpose: {
              type: 'text',
              instructions: 'Primary intended uses or tasks',
            },
            memory: {
              type: 'text',
              instructions: 'RAM or memory specification mentioned',
            },
          },
        }),
      }).then((r) => (r.ok ? r.json() : null));

      const [decisionRes, extractionRes] = await Promise.all([
        decisionPromise,
        extractionPromise,
      ]);

      if (decisionRes?.answers?.category) {
        chosenCategory = decisionRes.answers.category.choice;
        decisionConfidence = decisionRes.answers.category.confidence;
      }

      if (extractionRes?.answers?.budget?.value) {
        const raw = extractionRes.answers.budget.value.replace(/[^0-9]/g, '');
        extractedBudget = Number(raw) || 0;
        // Check for 'k' or 'lakh' in the original prompt
        if (text.toLowerCase().includes('lakh')) {
          extractedBudget = extractedBudget <= 100 ? extractedBudget * 100000 : extractedBudget;
        } else if (text.toLowerCase().includes('k')) {
          extractedBudget = extractedBudget <= 1000 ? extractedBudget * 1000 : extractedBudget;
        }
      }
    } catch (err) {
      console.warn('OpenRouter API call notice, using fallback parser:', err);
    } finally {
      setLoading(false);
    }

    // Fallback if extraction returned 0
    if (!extractedBudget || !chosenCategory) {
      const fb = fallbackParse();
      if (!extractedBudget) extractedBudget = fb.budget;
      if (!chosenCategory) chosenCategory = fb.category;
    }

    const hits = PRODUCTS.filter((p) => {
      if (chosenCategory && p.category !== chosenCategory) return false;
      if (!chosenCategory && !['Laptops', 'Desktops', 'All-in-One', 'Gaming'].includes(p.category)) return false;
      if (p.price > extractedBudget) return false;
      return true;
    })
      .sort((a, b) => a.price - b.price)
      .slice(0, 3);

    setResultHtml(
      <div className="ai-analysis-results">
        <div className="ai-brief-card">
          <p>
            <strong>Your brief:</strong> {text}
          </p>
          <p>
            <strong>Interpreted budget:</strong> {formatINR(extractedBudget)}
            {chosenCategory ? ` · Target Category: ${chosenCategory}` : ''}
          </p>
          {decisionConfidence !== null && (
            <div style={{ marginTop: 6, fontSize: 11, color: '#9db8ff' }}>
              ⚡ OpenRouter Decision Confidence: {(decisionConfidence * 100).toFixed(1)}% (via Perplexity Decider)
            </div>
          )}
        </div>

        {hits.length > 0 ? (
          <div className="ai-recommendation-list">
            {hits.map((p) => (
              <article key={p.id} className="ai-rec-card">
                <div className="ai-rec-header">
                  <strong>
                    {p.name} · {formatINR(p.price)}
                  </strong>
                  <span className="ai-rec-status">Availability: unknown · demo data</span>
                </div>
                <p className="ai-rec-desc">
                  {p.cpu ? `${p.cpu}; ` : ''}
                  {p.specs}. Within your stated budget. Suitability beyond these specifications has not been evaluated.
                </p>
                <button
                  type="button"
                  className="plain text-button rec-add-btn"
                  data-add={p.id}
                  onClick={() => onAddToCart(p.id)}
                >
                  Add to demo bag ↗
                </button>
              </article>
            ))}
          </div>
        ) : (
          <div className="ai-no-match">
            <p>
              No catalogue products match those constraints. Try adjusting your budget or category. No above-budget products were substituted.
            </p>
          </div>
        )}

        <p className="muted ai-disclaimer-note">
          Live AI powered by OpenRouter Decision &amp; Extraction APIs.
        </p>
      </div>
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!needText.trim()) return;
    evaluateBrief(needText);
  };

  const handleExampleClick = (prompt: string) => {
    setNeedText(prompt);
    evaluateBrief(prompt);
  };

  return (
    <section className="section assistant-section" id="assistant" aria-labelledby="assistant-title">
      <div className="wrap assistant-grid">
        {/* Left Column */}
        <div className="assistant-intro">
          <p className="eyebrow-tag">A little direction. A lot of possibility.</p>
          <h2 id="assistant-title" className="assistant-title">
            Find your kind
            <br />
            of powerful.
          </h2>
          <p className="muted assistant-lead">
            Tell us what you love doing. Start with your budget,
            <br />
            and we&apos;ll help narrow the possibilities.
          </p>
          <span className="badge badge-subtle">
            Powered by OpenRouter Decider &amp; Neon DB
          </span>
        </div>

        {/* Right Column */}
        <div className="assistant-interface">
          <form id="shopping-form" className="prompt-box" onSubmit={handleSubmit}>
            <label htmlFor="need" className="prompt-label">
              What will you use your next computer for?
            </label>
            <textarea
              id="need"
              rows={4}
              value={needText}
              onChange={(e) => setNeedText(e.target.value)}
              placeholder="A laptop under ₹70,000 for coding and travel…"
              required
            />
            <button
              type="submit"
              className="btn blue assistant-submit-btn"
              disabled={loading}
            >
              <span>{loading ? 'Evaluating with Perplexity Decider…' : 'Find my match'}</span>
              <span className="btn-arrow" aria-hidden="true">↗</span>
            </button>
          </form>

          {/* Quick Examples */}
          <div className="examples">
            <button
              type="button"
              data-example="A laptop under 70000 for coding and travel"
              onClick={() => handleExampleClick('A laptop under 70000 for coding and travel')}
            >
              Coding & travel ↗
            </button>
            <button
              type="button"
              data-example="A desktop under 60000 for home office"
              onClick={() => handleExampleClick('A desktop under 60000 for home office')}
            >
              My home office ↗
            </button>
            <button
              type="button"
              data-example="A gaming laptop under 100000"
              onClick={() => handleExampleClick('A gaming laptop under 100000')}
            >
              Gaming setup ↗
            </button>
          </div>

          {/* Dynamic Result Container */}
          <div id="ai-result" className="ai-result" aria-live="polite">
            {resultHtml}
          </div>
        </div>
      </div>
    </section>
  );
};
