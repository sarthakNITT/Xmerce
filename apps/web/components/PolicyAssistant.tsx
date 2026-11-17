import React, { useState } from 'react';

interface PolicyAssistantProps {
  onSelectPolicy: (key: string) => void;
  onCustomQuestion: (question: string) => void;
}

export const PolicyAssistant: React.FC<PolicyAssistantProps> = ({
  onSelectPolicy,
  onCustomQuestion,
}) => {
  const [questionText, setQuestionText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim()) return;
    onCustomQuestion(questionText.trim());
  };

  return (
    <section id="help" className="section policy-section wrap" aria-labelledby="policy-heading">
      <div className="support-grid">
        {/* Left Column: Ask NovaTech & Topic Shortcuts */}
        <div className="policy-main">
          <p className="eyebrow-tag">Ask NovaTech</p>
          <h2 id="policy-heading" className="section-title">
            Good questions.
            <br />
            Clear answers.
          </h2>
          <p className="muted policy-intro-sub">
            Explore the supplied policies, with the source always in view.
          </p>

          <div className="topics-grid">
            <button
              type="button"
              className="topic-btn"
              data-policy="returns"
              onClick={() => onSelectPolicy('returns')}
            >
              <span>Returns</span>
              <span className="topic-arrow" aria-hidden="true">↗</span>
            </button>
            <button
              type="button"
              className="topic-btn"
              data-policy="delivery"
              onClick={() => onSelectPolicy('delivery')}
            >
              <span>Delivery</span>
              <span className="topic-arrow" aria-hidden="true">↗</span>
            </button>
            <button
              type="button"
              className="topic-btn"
              data-policy="warranty"
              onClick={() => onSelectPolicy('warranty')}
            >
              <span>Warranty</span>
              <span className="topic-arrow" aria-hidden="true">↗</span>
            </button>
            <button
              type="button"
              className="topic-btn"
              data-policy="refunds"
              onClick={() => onSelectPolicy('refunds')}
            >
              <span>Refunds</span>
              <span className="topic-arrow" aria-hidden="true">↗</span>
            </button>
          </div>

          <form id="policy-form" className="policy-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="question">
              Ask a policy question
            </label>
            <input
              id="question"
              type="text"
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Ask about a policy… (e.g., return window, warranty)"
              required
            />
            <button type="submit" className="btn policy-submit-btn">
              <span>Ask</span>
              <span aria-hidden="true">↗</span>
            </button>
          </form>

          <p className="muted policy-caveat">
            Approved sample excerpts · local lookup demo, not live AI retrieval.
          </p>
        </div>

        {/* Right Column: NovaClub Tier Card */}
        <aside className="club">
          <p className="eyebrow-tag">NovaClub</p>
          <h3 className="club-headline">
            A little more,
            <br />
            every time.
          </h3>
          <ul className="club-perks-list">
            <li>
              <strong>Standard</strong> — 1× points and free standard delivery above ₹5,000.
            </li>
            <li>
              <strong>Silver</strong> — 1.5× points and priority support chat.
            </li>
            <li>
              <strong>Gold</strong> — 2× points, free express delivery and early sale access.
            </li>
          </ul>
          <button
            type="button"
            className="text-button club-details-link"
            data-policy="membership"
            onClick={() => onSelectPolicy('membership')}
          >
            Explore the benefits ↗
          </button>
        </aside>
      </div>
    </section>
  );
};
