import React from 'react';
import type { Product } from '../data/products';

interface DeviceArtProps {
  product: Product;
  variant?: 'card' | 'hero' | 'quickview';
}

export const DeviceArt: React.FC<DeviceArtProps> = ({ product, variant = 'card' }) => {
  if (product.image) {
    return (
      <img
        src={product.image}
        alt={product.name}
        className="product-actual-img"
        style={{ width: '90%', height: '90%', objectFit: 'contain' }}
        loading="lazy"
      />
    );
  }

  const isLaptop = product.category === 'Laptops' || product.category === 'Gaming';

  if (isLaptop) {
    return (
      <div className={`device-wrapper device-${variant}`} aria-hidden="true">
        <div className="device">
          <div className={`device-screen ${product.category === 'Gaming' ? 'gaming-glow' : ''}`}>
            <span>{product.name}</span>
          </div>
          <div className="device-base" />
        </div>
        <span className="art-disclaimer">ILLUSTRATIVE · IMAGE COMING SOON</span>
      </div>
    );
  }

  if (product.category === 'Desktops' || product.category === 'All-in-One' || product.category === 'Monitors') {
    return (
      <div className={`device-wrapper device-${variant}`} aria-hidden="true">
        <svg
          viewBox="0 0 60 48"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="device-desktop-svg"
        >
          <rect x="6" y="4" width="48" height="30" rx="3" />
          <path d="M22 34v6m16-6v6M16 40h28" />
          <circle cx="30" cy="19" r="4" strokeDasharray="2 2" />
        </svg>
        <span className="art-disclaimer">ILLUSTRATIVE · PRODUCT IMAGE COMING SOON</span>
      </div>
    );
  }

  // Accessories / NovaCare
  return (
    <div className={`device-wrapper device-${variant}`} aria-hidden="true">
      <svg
        viewBox="0 0 60 48"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="device-shield-svg"
      >
        <path d="M30 6l18 6v12c0 13-8 20-18 22-10-2-18-9-18-22V12l18-6z" />
        <path d="M24 23l4 4 8-8" />
      </svg>
      <span className="art-disclaimer">SERVICE COVER · DETAILS BELOW</span>
    </div>
  );
};
