'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { useCart } from '../../lib/useCart';
import { formatINR } from '../../data/products';
import { DEMO_NUMBER } from '../../order-confirmation/order-service';

function CheckoutContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('orderNumber') || DEMO_NUMBER;
  const isPaymentFailed = searchParams.get('payment') === 'failed';

  const { cart, cartCount } = useCart();
  const [selectedPayment, setSelectedPayment] = useState<'CARD' | 'COD' | 'UPI'>('CARD');
  const [searchQuery, setSearchQuery] = useState('');

  // Address State
  const [address, setAddress] = useState({
    recipient: 'Alex Morgan',
    line1: '42 Example Avenue',
    line2: 'Apartment 3B',
    city: 'Bengaluru',
    region: 'Karnataka',
    postalCode: '560001',
    phone: '+91 98765 43210',
  });

  const subtotal = cart?.totals.subtotal ?? 64990;
  const shipping = cart?.totals.shipping ?? 0;
  const grandTotal = subtotal + shipping;

  return (
    <div className="site-shell min-h-screen bg-[#f7f7f2] text-[#18211f]">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartCount={cartCount}
        onOpenCart={() => {}}
        onOpenInfo={() => {}}
        onOpenPolicy={() => {}}
        selectedCategory="All"
        onSelectCategory={() => {}}
      />

      <main className="wrap" style={{ padding: '38px 0 80px' }}>
        {/* Breadcrumb Navigation */}
        <div className="breadcrumb" style={{ marginBottom: 16 }}>
          <Link href="/">Home</Link> / <Link href="/cart">Cart</Link> / Checkout
        </div>

        {/* 1. Payment Failed Alert Banner */}
        {isPaymentFailed && (
          <section
            role="alert"
            style={{
              background: '#fcf0ed',
              border: '1px solid #ecc9c0',
              borderRadius: 8,
              padding: '24px 28px',
              marginBottom: 32,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <span style={{ fontSize: 24, lineHeight: 1 }} aria-hidden="true">
                ⚠️
              </span>
              <div style={{ flex: 1 }}>
                <h1 style={{ fontSize: 22, fontWeight: 600, color: '#9f2525', margin: '0 0 6px' }}>
                  Payment needs attention
                </h1>
                <p style={{ fontSize: 14, color: '#59625e', margin: '0 0 16px', lineHeight: 1.5 }}>
                  The payment authorization for order <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>{orderNumber}</code> was declined or cancelled by your card provider. No funds have been debited from your account.
                </p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  <Link
                    href={`/order-confirmation?orderNumber=${encodeURIComponent(orderNumber)}&variant=paid`}
                    className="button blue"
                    style={{ textDecoration: 'none' }}
                  >
                    Retry with Card / UPI ↗
                  </Link>

                  <Link
                    href={`/order-confirmation?orderNumber=${encodeURIComponent(orderNumber)}&variant=cod`}
                    className="button"
                    style={{ textDecoration: 'none' }}
                  >
                    Switch to Cash on Delivery (COD) ↗
                  </Link>

                  <Link
                    href="/cart"
                    className="text-button"
                    style={{ padding: '8px 12px', textDecoration: 'underline' }}
                  >
                    Return to cart
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 2. Main Checkout Grid */}
        <div className="cart-layout">
          {/* Left Column: Delivery & Payment Options */}
          <div style={{ display: 'grid', gap: 28 }}>
            <section
              style={{
                background: '#edf0e7',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: 24,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>
                1. Delivery address
              </h2>
              <address style={{ fontStyle: 'normal', fontSize: 14, lineHeight: 1.6, color: '#59625e' }}>
                <strong style={{ color: '#18211f' }}>{address.recipient}</strong> ({address.phone})
                <br />
                {address.line1}, {address.line2}
                <br />
                {address.city}, {address.region} {address.postalCode}
                <br />
                India
              </address>
            </section>

            <section
              style={{
                background: '#edf0e7',
                border: '1px solid var(--line)',
                borderRadius: 8,
                padding: 24,
              }}
            >
              <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 14 }}>
                2. Select payment method
              </h2>

              <div style={{ display: 'grid', gap: 12 }}>
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 6,
                    background: selectedPayment === 'CARD' ? '#ffffff' : 'transparent',
                    border: '1px solid',
                    borderColor: selectedPayment === 'CARD' ? 'var(--blue)' : 'var(--line)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="CARD"
                    checked={selectedPayment === 'CARD'}
                    onChange={() => setSelectedPayment('CARD')}
                  />
                  <div>
                    <strong>Credit / Debit Card</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Visa, MasterCard, RuPay (e.g. Card ending 4242)
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 6,
                    background: selectedPayment === 'UPI' ? '#ffffff' : 'transparent',
                    border: '1px solid',
                    borderColor: selectedPayment === 'UPI' ? 'var(--blue)' : 'var(--line)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="UPI"
                    checked={selectedPayment === 'UPI'}
                    onChange={() => setSelectedPayment('UPI')}
                  />
                  <div>
                    <strong>UPI Instant Transfer</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Google Pay, PhonePe, Paytm, BHIM
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderRadius: 6,
                    background: selectedPayment === 'COD' ? '#ffffff' : 'transparent',
                    border: '1px solid',
                    borderColor: selectedPayment === 'COD' ? 'var(--blue)' : 'var(--line)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="radio"
                    name="payment"
                    value="COD"
                    checked={selectedPayment === 'COD'}
                    onChange={() => setSelectedPayment('COD')}
                  />
                  <div>
                    <strong>Cash on Delivery (COD)</strong>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      Pay at your doorstep upon package arrival
                    </div>
                  </div>
                </label>
              </div>
            </section>
          </div>

          {/* Right Column: Order Summary */}
          <aside className="cart-summary-box">
            <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 18 }}>
              Order summary
            </h2>

            <dl>
              <div className="cart-summary-row">
                <dt>Items subtotal</dt>
                <dd>{formatINR(subtotal)}</dd>
              </div>
              <div className="cart-summary-row">
                <dt>Shipping</dt>
                <dd>{shipping === 0 ? 'Free' : formatINR(shipping)}</dd>
              </div>
              <div className="cart-summary-row total">
                <dt>{selectedPayment === 'COD' ? 'Total due' : 'Order total'}</dt>
                <dd>{formatINR(grandTotal)}</dd>
              </div>
            </dl>

            <Link
              href={`/order-confirmation?orderNumber=${encodeURIComponent(orderNumber)}&variant=${
                selectedPayment === 'COD' ? 'cod' : 'paid'
              }`}
              className="button blue btn-checkout"
              style={{ textDecoration: 'none', textAlign: 'center', marginTop: 18 }}
            >
              {selectedPayment === 'COD' ? 'Confirm order (Pay on delivery) ↗' : 'Authorize & Place order ↗'}
            </Link>

            <p className="notice" style={{ margin: '14px 0 0', fontSize: 11, textAlign: 'center' }}>
              Encrypted 256-bit payment handoff to NovaTech Order Service.
            </p>
          </aside>
        </div>
      </main>

      <Footer onOpenPolicy={() => {}} onOpenInfo={() => {}} />
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f7f7f2' }}>
          <p style={{ color: '#59625e', fontSize: 15 }}>Loading checkout…</p>
        </div>
      }
    >
      <CheckoutContent />
    </Suspense>
  );
}
