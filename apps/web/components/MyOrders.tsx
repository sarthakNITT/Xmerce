'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SignInButton, useAuth } from '@clerk/nextjs';
import { backendFetch } from '../lib/cart';
import { formatINR } from '../data/products';

interface OrderSummary {
  id: string;
  orderNumber: string;
  status: 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED';
  total: number;
  createdAt: string;
  items: { title: string; quantity: number }[];
}

const STATUS_LABEL: Record<OrderSummary['status'], string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Confirmed',
  CANCELLED: 'Cancelled',
};

/** "My orders" panel: the signed-in user's orders from apps/backend (GET /api/orders). */
export function MyOrders() {
  const { isLoaded, isSignedIn } = useAuth();
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    backendFetch<{ data: OrderSummary[] }>('/api/orders?limit=20')
      .then((r) => setOrders(r.data))
      .catch((e: Error) => setError(e.message));
  }, [isLoaded, isSignedIn]);

  return (
    <section id="orders" className="panel">
      <div className="panel-head">
        <h2>My orders</h2>
        {orders && <span className="badge">{orders.length}</span>}
      </div>
      {!isLoaded ? (
        <p className="muted">Loading…</p>
      ) : !isSignedIn ? (
        <>
          <p className="muted" style={{ marginBottom: 16 }}>Sign in to see your orders.</p>
          <SignInButton mode="modal">
            <button className="btn btn-outline">Sign in ↗</button>
          </SignInButton>
        </>
      ) : error ? (
        <p className="muted">{error}</p>
      ) : !orders ? (
        <p className="muted">Loading your orders…</p>
      ) : orders.length === 0 ? (
        <>
          <p className="muted" style={{ marginBottom: 16 }}>No orders yet.</p>
          <Link className="btn btn-outline" href="/search">Explore the collection ↗</Link>
        </>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
          {orders.map((o) => (
            <li key={o.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
              <div>
                <Link href={`/order-confirmation?orderId=${o.id}`} style={{ fontWeight: 600 }}>{o.orderNumber}</Link>
                <div className="muted" style={{ fontSize: 13 }}>
                  {new Date(o.createdAt).toLocaleDateString()} · {o.items.map((i) => `${i.title} × ${i.quantity}`).join(', ')}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div>{formatINR(o.total)}</div>
                <div className="muted" style={{ fontSize: 13 }}>{STATUS_LABEL[o.status]}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
