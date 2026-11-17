'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { backendFetch } from '../../lib/cart';
import { formatINR } from '../../data/products';

interface Order {
  id: string;
  orderNumber: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED';
  subtotal: number;
  shippingFee: number;
  total: number;
  shippingAddress: { fullName: string; line1: string; line2?: string; city: string; state: string; postalCode: string; country: string; phone: string };
  items: { productId: string | null; title: string; quantity: number; unitPrice: number; lineTotal: number }[];
  payment: { status: string; method: string; transactionId: string } | null;
  estimatedDelivery: string | null;
  createdAt: string;
}

/** Order confirmation: reads the real order from apps/backend (GET /api/orders/:id). */
function Confirmation() {
  const orderId = useSearchParams().get('orderId');
  const { isLoaded, isSignedIn } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!isSignedIn) return setError('Sign in to view this order.');
    if (!orderId) return setError('No order selected.');
    backendFetch<{ order: Order }>(`/api/orders/${encodeURIComponent(orderId)}`)
      .then((r) => setOrder(r.order))
      .catch((e: Error) => setError(e.message));
  }, [isLoaded, isSignedIn, orderId]);

  if (error) {
    return (
      <main className="wrap" style={{ padding: '60px 0' }}>
        <h1>Order not available</h1>
        <p>{error}</p>
        <Link href="/" className="button blue" style={{ textDecoration: 'none' }}>Back to store</Link>
      </main>
    );
  }
  if (!order) return <main className="wrap" style={{ padding: '60px 0' }}>Loading your order…</main>;

  const a = order.shippingAddress;
  return (
    <main className="wrap" style={{ padding: '48px 0 80px', maxWidth: 760 }}>
      <p style={{ color: '#2f6f4f', fontWeight: 600, margin: 0 }}>
        {order.status === 'PAID' ? 'Payment received' : order.status === 'CANCELLED' ? 'Order cancelled' : 'Awaiting payment'}
      </p>
      <h1 style={{ fontSize: 32, margin: '6px 0 4px' }}>Thank you — your order is confirmed</h1>
      <p style={{ color: '#59625e', margin: '0 0 28px' }}>
        Order <strong>{order.orderNumber}</strong>
        {order.estimatedDelivery && <> · Estimated delivery {new Date(order.estimatedDelivery).toDateString()}</>}
      </p>

      <section style={{ background: '#edf0e7', border: '1px solid var(--line)', borderRadius: 8, padding: 24, marginBottom: 20 }}>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 10 }}>
          {order.items.map((i, idx) => (
            <li key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>{i.title} × {i.quantity}</span>
              <span>{formatINR(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
          <span>Total paid</span>
          <span>{formatINR(order.total)}</span>
        </div>
        {order.payment && (
          <p style={{ fontSize: 13, color: '#59625e', margin: '8px 0 0' }}>
            {order.payment.method.replace('_', ' ')} · {order.payment.status} · {order.payment.transactionId}
          </p>
        )}
      </section>

      <section style={{ fontSize: 14, color: '#59625e', marginBottom: 28 }}>
        <strong style={{ color: '#18211f' }}>Delivering to</strong>
        <br />
        {a.fullName}, {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}, {a.country} · {a.phone}
      </section>

      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/search" className="button blue" style={{ textDecoration: 'none' }}>Continue shopping</Link>
        <Link href="/profile" className="button" style={{ textDecoration: 'none' }}>Your orders</Link>
      </div>
    </main>
  );
}

export default function OrderConfirmationPage() {
  return (
    <div className="site-shell min-h-screen bg-[#f7f7f2] text-[#18211f]">
      <Suspense fallback={<main className="wrap">Loading…</main>}>
        <Confirmation />
      </Suspense>
    </div>
  );
}
