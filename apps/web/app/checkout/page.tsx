'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SignInButton, useAuth } from '@clerk/nextjs';
import { Header } from '../../components/Header';
import { Footer } from '../../components/Footer';
import { useCart } from '../../lib/useCart';
import { backendFetch, cartApi } from '../../lib/cart';
import { formatINR } from '../../data/products';

type Totals = { subtotal: number; shippingFee: number; tax: number; total: number };
type PaymentMethod = 'CARD' | 'UPI' | 'NET_BANKING' | 'WALLET';

const box: React.CSSProperties = { background: '#edf0e7', border: '1px solid var(--line)', borderRadius: 8, padding: 24 };
const input: React.CSSProperties = { width: '100%', padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 6, font: 'inherit', background: '#fff' };

/**
 * Real checkout against apps/backend:
 *  1. signed-in only (guest bag is merged into the account on sign-in)
 *  2. GET /api/checkout  -> totals
 *  3. POST /api/orders   -> order awaiting payment (stock reserved)
 *  4. POST /api/orders/:id/pay -> mock payment, then the confirmation page
 */
export default function CheckoutPage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { cart, cartCount, reload } = useCart();
  const [searchQuery, setSearchQuery] = useState('');
  const [totals, setTotals] = useState<Totals | null>(null);
  const [method, setMethod] = useState<PaymentMethod>('CARD');
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrderId, setPendingOrderId] = useState<string | null>(null);
  const [address, setAddress] = useState({
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'India',
  });

  // After sign-in: move the guest bag into the account, then load totals.
  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    cartApi
      .mergeGuestCart()
      .catch(() => {})
      .then(() => backendFetch<{ totals: Totals }>('/api/checkout'))
      .then((r) => setTotals(r.totals))
      .catch((e: Error) => setError(e.message))
      .finally(() => void reload());
  }, [isLoaded, isSignedIn, reload]);

  async function pay(orderId: string) {
    try {
      await backendFetch(`/api/orders/${orderId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ method, simulate: simulateFailure ? 'failure' : 'success' }),
      });
      window.dispatchEvent(new CustomEvent('novatech:cart-updated'));
      router.push(`/order-confirmation?orderId=${encodeURIComponent(orderId)}`);
    } catch (e) {
      const err = e as Error & { code?: string };
      setPendingOrderId(err.code === 'PAYMENT_FAILED' ? orderId : null);
      setError(err.code === 'PAYMENT_FAILED' ? 'Payment was declined (mock). Your order is saved — try again.' : err.message);
    }
  }

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (pendingOrderId) {
        await pay(pendingOrderId);
        return;
      }
      const { order } = await backendFetch<{ order: { id: string } }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({ shippingAddress: { ...address, line2: address.line2 || undefined } }),
      });
      await pay(order.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof address, label: string, required = true) => (
    <label style={{ display: 'grid', gap: 4, fontSize: 13 }}>
      {label}
      <input
        style={input}
        required={required}
        value={address[key]}
        onChange={(e) => setAddress((a) => ({ ...a, [key]: e.target.value }))}
      />
    </label>
  );

  return (
    <div className="site-shell min-h-screen bg-[#f7f7f2] text-[#18211f]">
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        cartCount={cartCount}
        onOpenCart={() => router.push('/cart')}
        onOpenInfo={() => {}}
        onOpenPolicy={() => {}}
        selectedCategory="All"
        onSelectCategory={() => {}}
      />

      <main className="wrap" style={{ padding: '38px 0 80px' }}>
        <div className="breadcrumb" style={{ marginBottom: 16 }}>
          <Link href="/">Home</Link> / <Link href="/cart">Cart</Link> / Checkout
        </div>

        {!isLoaded ? (
          <p>Loading…</p>
        ) : !isSignedIn ? (
          <section style={box}>
            <h1 style={{ margin: '0 0 8px', fontSize: 24 }}>Sign in to check out</h1>
            <p style={{ margin: '0 0 16px', color: '#59625e' }}>
              Your bag is saved. After you sign in it moves into your account and you can pay.
            </p>
            <SignInButton mode="modal" forceRedirectUrl="/checkout">
              <button className="button blue">Sign in to continue</button>
            </SignInButton>
          </section>
        ) : !cart || cart.items.length === 0 ? (
          <section style={box}>
            <h1 style={{ margin: '0 0 8px', fontSize: 24 }}>Your bag is empty</h1>
            <Link href="/search" className="button blue" style={{ textDecoration: 'none' }}>
              Browse products
            </Link>
          </section>
        ) : (
          <form className="cart-layout" onSubmit={placeOrder}>
            <div style={{ display: 'grid', gap: 28 }}>
              <section style={box}>
                <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>Delivery address</h2>
                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
                  {field('fullName', 'Full name')}
                  {field('phone', 'Phone')}
                  <div style={{ gridColumn: '1 / -1' }}>{field('line1', 'Address line 1')}</div>
                  <div style={{ gridColumn: '1 / -1' }}>{field('line2', 'Address line 2 (optional)', false)}</div>
                  {field('city', 'City')}
                  {field('state', 'State')}
                  {field('postalCode', 'PIN code')}
                  {field('country', 'Country')}
                </div>
              </section>

              <section style={box}>
                <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>Payment (mock — no real money moves)</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                  {(['CARD', 'UPI', 'NET_BANKING', 'WALLET'] as PaymentMethod[]).map((m) => (
                    <label key={m} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="radio" name="method" checked={method === m} onChange={() => setMethod(m)} />
                      {m.replace('_', ' ')}
                    </label>
                  ))}
                </div>
                <label style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, fontSize: 13, color: '#59625e' }}>
                  <input type="checkbox" checked={simulateFailure} onChange={(e) => setSimulateFailure(e.target.checked)} />
                  Simulate a declined payment
                </label>
              </section>

              {error && (
                <p role="alert" style={{ color: '#9f2525', margin: 0 }}>
                  {error}
                </p>
              )}
            </div>

            <aside style={box}>
              <h2 style={{ margin: '0 0 16px', fontSize: 20 }}>Order summary</h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px', display: 'grid', gap: 10 }}>
                {cart.items.map((i) => (
                  <li key={i.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                    <span>
                      {i.name} × {i.quantity}
                    </span>
                    <span>{formatINR(i.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              {totals && (
                <dl style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6, fontSize: 14, margin: '0 0 16px' }}>
                  <dt>Subtotal</dt>
                  <dd style={{ margin: 0 }}>{formatINR(totals.subtotal)}</dd>
                  <dt>Shipping</dt>
                  <dd style={{ margin: 0 }}>{totals.shippingFee ? formatINR(totals.shippingFee) : 'Free'}</dd>
                  <dt style={{ fontWeight: 600 }}>Total</dt>
                  <dd style={{ margin: 0, fontWeight: 600 }}>{formatINR(totals.total)}</dd>
                </dl>
              )}
              <button type="submit" className="button blue" disabled={busy || !cart.canCheckout} style={{ width: '100%' }}>
                {busy ? 'Processing…' : pendingOrderId ? 'Retry payment' : `Place order & pay${totals ? ` ${formatINR(totals.total)}` : ''}`}
              </button>
              {!cart.canCheckout && (
                <p style={{ fontSize: 13, color: '#9f2525' }}>Some items are out of stock. Update your bag first.</p>
              )}
            </aside>
          </form>
        )}
      </main>

      <Footer onOpenInfo={() => {}} onOpenPolicy={() => {}} />
    </div>
  );
}
