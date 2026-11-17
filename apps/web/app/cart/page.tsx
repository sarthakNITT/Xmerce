'use client';

import React, { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { useCart } from '../../lib/useCart';
import { formatINR } from '../../data/products';
import { POLICIES, INTEGRATION_INFOS } from '../../data/policies';

export default function CartPage() {
  const {
    cart,
    cartCount,
    loading,
    busy,
    error,
    customerCode,
    setQuantity,
    removeItem,
    setCustomerCode,
    reload,
  } = useCart();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [editingCustomerCode, setEditingCustomerCode] = useState(false);
  const [inputCustomerCode, setInputCustomerCode] = useState('');

  // Dialog State (for info and checkout previews)
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [panelTitle, setPanelTitle] = useState('');
  const [panelBody, setPanelBody] = useState<React.ReactNode>(null);

  const openPanel = useCallback((title: string, content: React.ReactNode) => {
    setPanelTitle(title);
    setPanelBody(content);
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
  }, []);

  const closePanel = useCallback(() => {
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, []);

  const handleInfo = useCallback(
    (key: 'account' | 'orders' | 'checkout' | 'support') => {
      const info = INTEGRATION_INFOS[key];
      if (!info) return;
      openPanel(info.title, <p style={{ fontSize: 15, lineHeight: 1.5 }}>{info.body}</p>);
    },
    [openPanel]
  );

  const handlePolicy = useCallback(
    (key: string) => {
      const p = POLICIES[key];
      if (!p) return;
      openPanel('Ask NovaTech', <p>{p.content}</p>);
    },
    [openPanel]
  );

  const handleSetCustomerCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCustomerCode.trim()) {
      await setCustomerCode(null);
      setStatusMessage('Switched to guest session cart.');
    } else {
      await setCustomerCode(inputCustomerCode.trim());
      setStatusMessage(`Cart successfully linked to customer code "${inputCustomerCode.trim()}". Items merged.`);
    }
    setEditingCustomerCode(false);
  };

  const handleClearCustomerCode = async () => {
    await setCustomerCode(null);
    setInputCustomerCode('');
    setEditingCustomerCode(false);
    setStatusMessage('Switched to guest session cart.');
  };

  const handleCheckoutClick = () => {
    if (!cart || cart.items.length === 0) return;

    openPanel(
      'Checkout handoff ready',
      <div style={{ display: 'grid', gap: 16 }}>
        <p>
          The cart is validated and ready for the Java checkout and order placement module.
        </p>
        <div
          style={{
            background: '#e9eee3',
            padding: 14,
            borderRadius: 6,
            fontSize: 13,
            fontFamily: 'monospace',
          }}
        >
          <div><strong>Customer Code:</strong> {customerCode || 'GUEST-SESSION'}</div>
          <div><strong>Items count:</strong> {cart.items.reduce((s, i) => s + i.quantity, 0)}</div>
          <div><strong>Subtotal:</strong> {formatINR(cart.totals.subtotal)}</div>
          <div><strong>Estimated Total:</strong> {formatINR(cart.totals.total ?? cart.totals.subtotal)}</div>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)' }}>
          {INTEGRATION_INFOS.checkout.body}
        </p>
        <button type="button" className="btn btn-primary" onClick={closePanel}>
          Got it
        </button>
      </div>
    );
  };

  const hasItems = cart && cart.items.length > 0;

  return (
    <div className="site-shell">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartCount={cartCount}
        onOpenCart={() => {
          // Already on cart page, focus items
          document.getElementById('items-title')?.focus();
        }}
        onOpenInfo={handleInfo}
        onOpenPolicy={handlePolicy}
        selectedCategory="All"
        onSelectCategory={() => {}}
      />

      <main className="wrap" style={{ padding: '38px 0 80px' }}>
        {/* Breadcrumb Navigation */}
        <div className="breadcrumb" style={{ marginBottom: 12 }}>
          <Link href="/">Home</Link> / Your cart
        </div>

        <p className="eyebrow">One step closer</p>
        <h1 style={{ marginBottom: 12 }}>Make room for what’s next.</h1>
        <p className="muted intro">Review your picks before continuing to checkout.</p>

        {/* Customer Code & Device Cache Status Strip */}
        <section className="customer-session-bar" aria-label="Customer account cart linking">
          <div className="customer-session-info">
            <span style={{ fontWeight: 600 }}>Session status:</span>
            {customerCode ? (
              <span className="customer-code-tag">
                Linked Customer: <strong>{customerCode}</strong>
              </span>
            ) : (
              <span style={{ color: 'var(--muted)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#2e6930',
                  }}
                />
                Guest Cart (persistent device cache)
              </span>
            )}
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
              • Seamlessly preserved across reloads & synced across tabs
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!editingCustomerCode ? (
              <button
                type="button"
                className="text-button"
                style={{ minHeight: 36, padding: '4px 0', textDecoration: 'underline' }}
                onClick={() => {
                  setInputCustomerCode(customerCode || '');
                  setEditingCustomerCode(true);
                }}
              >
                {customerCode ? 'Switch customer code ↗' : 'Link unique customer code ↗'}
              </button>
            ) : (
              <form onSubmit={handleSetCustomerCode} className="customer-code-modal-input">
                <input
                  type="text"
                  placeholder="e.g. CUST-10492"
                  value={inputCustomerCode}
                  onChange={(e) => setInputCustomerCode(e.target.value)}
                  autoFocus
                />
                <button type="submit" className="button" style={{ minHeight: 36, padding: '4px 12px', fontSize: 12 }}>
                  Save & Merge
                </button>
                {customerCode && (
                  <button
                    type="button"
                    className="text-button"
                    style={{ minHeight: 36, padding: '4px 6px', fontSize: 12 }}
                    onClick={handleClearCustomerCode}
                  >
                    Unlink
                  </button>
                )}
                <button
                  type="button"
                  className="text-button"
                  style={{ minHeight: 36, padding: '4px 6px', fontSize: 12 }}
                  onClick={() => setEditingCustomerCode(false)}
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </section>

        {/* Feedback / Error banner */}
        <div className="cart-feedback-banner">
          <p
            id="status"
            className={`status ${error ? 'error' : ''}`}
            role="status"
            aria-live="polite"
          >
            {error || statusMessage || (loading ? 'Loading your cart…' : busy ? 'Updating your cart…' : '')}
          </p>
          {error && (
            <button
              type="button"
              className="text-button"
              onClick={reload}
              style={{ fontWeight: 600 }}
            >
              Reload cart ↗
            </button>
          )}
        </div>

        {/* Empty State */}
        {!loading && !hasItems && (
          <section id="empty" className="cart-empty-view">
            <h2>Your next favourite is waiting.</h2>
            <p>Your cart is empty. Explore the collection to get started.</p>
            <Link href="/search" className="button blue" style={{ textDecoration: 'none' }}>
              Explore products ↗
            </Link>
          </section>
        )}

        {/* Populated Cart Layout */}
        {!loading && hasItems && cart && (
          <div id="cart-layout" className="cart-layout" aria-busy={busy}>
            {/* Left Selection List */}
            <section aria-labelledby="items-title">
              <div className="cart-heading">
                <h2 id="items-title" tabIndex={-1}>
                  Your selection
                </h2>
                <span id="item-count">
                  {cart.items.reduce((sum, item) => sum + item.quantity, 0)} items
                </span>
              </div>

              <div id="cart-items">
                {cart.items.map((item) => {
                  const availabilityLabel =
                    item.availability === 'IN_STOCK'
                      ? 'In stock'
                      : item.availability === 'LOW_STOCK'
                      ? 'Limited stock'
                      : item.availability === 'OUT_OF_STOCK'
                      ? 'Out of stock — remove to continue'
                      : 'Availability confirmed at checkout';

                  const availabilityClass =
                    item.availability === 'LOW_STOCK'
                      ? 'low'
                      : item.availability === 'OUT_OF_STOCK'
                      ? 'out'
                      : '';

                  return (
                    <article key={item.id} className="cart-item">
                      <div className="cart-item-image">
                        {item.image ? (
                          <img
                            src={item.image}
                            alt={item.name}
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <svg viewBox="0 0 100 70" aria-hidden="true">
                            <rect x="15" y="8" width="70" height="46" rx="4" />
                            <path d="M7 59h86l-6 5H13z" />
                          </svg>
                        )}
                      </div>

                      <div className="cart-item-content">
                        <div>
                          <div className="product-top">
                            <div>
                              <h3>{item.name}</h3>
                              <p className="specs">{item.specs}</p>
                              <p className="unit-price">{formatINR(item.unitPrice)} each</p>
                            </div>
                            <div className="line-price">{formatINR(item.lineTotal)}</div>
                          </div>

                          <p className={`item-availability ${availabilityClass}`}>
                            {availabilityLabel}
                          </p>
                        </div>

                        <div className="item-actions">
                          <div className="quantity">
                            <button
                              type="button"
                              aria-label={`Decrease quantity for ${item.name}`}
                              disabled={item.quantity <= 1 || busy}
                              onClick={async () => {
                                try {
                                  await setQuantity(item.id, item.quantity - 1);
                                  setStatusMessage(`${item.name} quantity updated.`);
                                } catch {}
                              }}
                            >
                              −
                            </button>
                            <input
                              type="number"
                              min="1"
                              max={Math.max(1, item.maxQuantity)}
                              step="1"
                              value={item.quantity}
                              disabled={busy}
                              aria-label={`Quantity for ${item.name}`}
                              onChange={async (e) => {
                                const val = Number(e.target.value);
                                if (Number.isSafeInteger(val) && val >= 1 && val <= item.maxQuantity) {
                                  try {
                                    await setQuantity(item.id, val);
                                    setStatusMessage('Quantity updated.');
                                  } catch {}
                                }
                              }}
                            />
                            <button
                              type="button"
                              aria-label={`Increase quantity for ${item.name}`}
                              disabled={item.quantity >= item.maxQuantity || busy || item.availability === 'OUT_OF_STOCK'}
                              onClick={async () => {
                                try {
                                  await setQuantity(item.id, item.quantity + 1);
                                  setStatusMessage(`${item.name} quantity updated.`);
                                } catch {}
                              }}
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            className="text-button"
                            disabled={busy}
                            onClick={async () => {
                              try {
                                await removeItem(item.id);
                                setStatusMessage(`${item.name} removed from cart.`);
                              } catch {}
                            }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>

              <p style={{ marginTop: 24 }}>
                <Link href="/search" className="text-button" style={{ textDecoration: 'underline' }}>
                  ← Continue shopping
                </Link>
              </p>
            </section>

            {/* Right Summary Sidebar */}
            <aside className="cart-summary-box" aria-labelledby="summary-title">
              <h2 id="summary-title">Order summary</h2>
              <dl>
                <div className="cart-summary-row">
                  <dt>Subtotal</dt>
                  <dd id="subtotal">{formatINR(cart.totals.subtotal)}</dd>
                </div>
                <div className="cart-summary-row">
                  <dt>Discount</dt>
                  <dd id="discount">
                    {cart.totals.discount === null
                      ? 'At checkout'
                      : cart.totals.discount > 0
                      ? `−${formatINR(cart.totals.discount)}`
                      : formatINR(0)}
                  </dd>
                </div>
                <div className="cart-summary-row">
                  <dt>Tax</dt>
                  <dd id="tax">
                    {cart.totals.tax === null ? 'At checkout' : formatINR(cart.totals.tax)}
                  </dd>
                </div>
                <div className="cart-summary-row">
                  <dt>Shipping</dt>
                  <dd id="shipping">
                    {cart.totals.shipping === null
                      ? 'At checkout'
                      : cart.totals.shipping === 0
                      ? 'Free'
                      : formatINR(cart.totals.shipping)}
                  </dd>
                </div>
                <div className="cart-summary-row total">
                  <dt id="total-label">
                    {cart.totals.total === null
                      ? 'Estimated subtotal'
                      : cart.totals.estimated
                      ? 'Estimated total'
                      : 'Total'}
                  </dt>
                  <dd id="total">
                    {formatINR(cart.totals.total ?? cart.totals.subtotal)}
                  </dd>
                </div>
              </dl>

              <p className="notice" style={{ margin: '14px 0 0', fontSize: 12 }}>
                Browser-local persistent cache. Stock, discounts, and regional taxes will be finalized by the checkout service.
              </p>

              <button
                type="button"
                id="checkout"
                className="button blue btn-checkout"
                disabled={!cart.canCheckout || busy}
                onClick={handleCheckoutClick}
              >
                Continue to checkout ↗
              </button>

              <p className="notice" style={{ margin: '10px 0 0', fontSize: 11, textAlign: 'center' }}>
                Review delivery address and payment in the next step.
              </p>
            </aside>
          </div>
        )}
      </main>

      {/* Information / Modal Panel */}
      <dialog ref={dialogRef} className="panel-dialog" onClick={(e) => {
        if (e.target === dialogRef.current) closePanel();
      }}>
        <div className="dialog-shell">
          <div className="dialog-header">
            <h3>{panelTitle}</h3>
            <button
              type="button"
              className="dialog-close-btn"
              onClick={closePanel}
              aria-label="Close dialog"
            >
              ×
            </button>
          </div>
          <div className="dialog-body">{panelBody}</div>
        </div>
      </dialog>

      <Footer onOpenPolicy={handlePolicy} onOpenInfo={handleInfo} />
    </div>
  );
}
