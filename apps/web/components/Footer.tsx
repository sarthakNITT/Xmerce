import React from 'react';

interface FooterProps {
  onOpenInfo: (key: 'account' | 'orders' | 'checkout' | 'support') => void;
  onOpenPolicy: (key: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ onOpenInfo, onOpenPolicy }) => {
  return (
    <footer className="footer">
      <div className="wrap footer-content">
        <div className="footer-brand-col">
          <a href="#" className="brand-logo" aria-label="NovaTech homepage">
            nova<span className="logo-accent">tech</span>
            <span className="logo-arrow">↗</span>
          </a>
          <p className="footer-disclaimer">
            NovaTech storefront prototype. Prices and policies are from the hackathon sample. Product imagery is illustrative; stock, account, checkout and AI services are not connected.
          </p>
        </div>

        <div className="footer-nav-col">
          <div className="footer-links-group">
            <span className="footer-links-title">Support &amp; Policies</span>
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => onOpenPolicy('returns')}
            >
              Returns Policy
            </button>
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => onOpenPolicy('delivery')}
            >
              Shipping &amp; Delivery
            </button>
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => onOpenPolicy('warranty')}
            >
              Warranty Information
            </button>
            <button
              type="button"
              className="footer-link-btn"
              onClick={() => onOpenPolicy('refunds')}
            >
              Refund Timelines
            </button>
          </div>

          <div className="footer-links-group">
            <span className="footer-links-title">Account &amp; Orders</span>
            <a
              href="/profile#orders"
              className="footer-link-btn"
              data-info="orders"
            >
              My orders ↗
            </a>
            <a
              href="/profile"
              className="footer-link-btn"
              data-info="account"
            >
              My profile / Sign in ↗
            </a>
            <button
              type="button"
              className="footer-link-btn"
              data-info="support"
              onClick={() => onOpenInfo('support')}
            >
              Contact Support ↗
            </button>
          </div>
        </div>
      </div>

      <div className="wrap footer-bottom-strip">
        <span className="footer-copy">
          © {new Date().getFullYear()} NovaTech Direct Computers. Built for the AI Commerce Showcase.
        </span>
        <span className="badge badge-subtle">
          Offline Prototype · Ready for Java Backend &amp; Photos
        </span>
      </div>
    </footer>
  );
};
