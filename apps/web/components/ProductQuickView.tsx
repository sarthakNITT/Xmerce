'use client';

import React, { useEffect, useRef, useState } from 'react';
import { DeviceArt } from './DeviceArt';
import { useProducts } from '../lib/catalog';
import { cartApi } from '../lib/cart';
import { API_URL } from '../lib/api';
import { calculateSaving, formatINR } from '../data/products';

interface ProductDetail {
  description: string;
  stockCount: number;
  inStock: boolean;
  maxOrderQuantity: number;
}

/**
 * Product details modal, same layout as the catalogue/search quick view.
 * Pass a productId to open it; it reads the product from the shared catalogue
 * and live description/stock from GET /api/products/:slug.
 */
export function ProductQuickView({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  const PRODUCTS = useProducts();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const product = productId ? PRODUCTS.find((p) => p.id === productId) : undefined;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (productId && !dialog.open) dialog.showModal();
    if (!productId && dialog.open) dialog.close();
  }, [productId]);

  useEffect(() => {
    setDetail(null);
    setStatus(null);
    if (!productId) return;
    fetch(`${API_URL}/api/products/${encodeURIComponent(productId.toLowerCase())}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => body?.data && setDetail(body.data))
      .catch(() => {});
  }, [productId]);

  const saving = product ? calculateSaving(product.mrp, product.price) : null;

  async function add() {
    if (!product) return;
    try {
      await cartApi.addItem(product.id, 1);
      setStatus('Added to your bag.');
      setTimeout(onClose, 700);
    } catch (e) {
      setStatus((e as Error).message);
    }
  }

  return (
    <dialog id="panel" ref={dialogRef} aria-labelledby="quickview-title" onClose={onClose} onCancel={onClose}>
      <div className="dialog-head">
        <h2 id="quickview-title">{product?.name ?? 'Product'}</h2>
        <button type="button" className="plain dialog-close-btn" aria-label="Close dialog" onClick={onClose}>
          ×
        </button>
      </div>
      <div id="panel-body">
        {!product ? (
          <p className="notice">Loading product…</p>
        ) : (
          <div className="quickview-shell">
            <div className="product-art quickview-art">
              <DeviceArt product={product} variant="quickview" />
            </div>
            <p className="quickview-specs">
              {product.cpu ? `${product.cpu} · ` : ''}
              {product.specs}
            </p>
            {product.videoBatteryLife && <p className="quickview-battery">🔋 {product.videoBatteryLife}</p>}
            {detail?.description && <p className="quickview-specs">{detail.description}</p>}
            <div className="product-price quickview-price">
              <span className="current-price-val">{formatINR(product.price)}</span>
              {product.mrp && <del className="mrp-val">{formatINR(product.mrp)}</del>}
              {saving && (
                <span className="hero-saving-pill" style={{ marginLeft: 10 }}>
                  Save {formatINR(saving)}
                </span>
              )}
            </div>
            <p className="notice">
              {detail
                ? detail.inStock
                  ? detail.stockCount <= 5
                    ? `Only ${detail.stockCount} left in stock.`
                    : 'In stock.'
                  : 'Out of stock.'
                : 'Checking stock…'}
            </p>
            <button type="button" className="btn btn-primary" disabled={detail ? !detail.inStock : false} onClick={add}>
              Add to bag +
            </button>
            {status && <p role="status" className="notice">{status}</p>}
          </div>
        )}
      </div>
    </dialog>
  );
}
