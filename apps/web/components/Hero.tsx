import React from 'react';
import type { Product } from '../data/products';
import { formatINR, calculateSaving } from '../data/products';

interface HeroProps {
  product: Product;
  onExplore: (productId: string) => void;
  onQuickAdd: (productId: string) => void;
}

export const Hero: React.FC<HeroProps> = ({ product, onExplore, onQuickAdd }) => {
  const saving = calculateSaving(product.mrp, product.price);

  return (
    <section className="hero-section" aria-labelledby="hero-title">
      <div className="wrap">
        <div className="hero-grid">
          {/* Left Column: Editorial & Value Proposition */}
          <div className="hero-editorial">
            <div className="hero-eyebrow">
              <span className="pulsing-dot" aria-hidden="true" />
              <span>Meet the {product.name}</span>
            </div>

            <h1 id="hero-title" className="hero-headline">
              Big ideas.
              <br />
              <em className="hero-highlight">Light work.</em>
            </h1>

            <p className="hero-subtext">
              For everything you&apos;re about to make.
              <br />
              16 GB memory. A 2.2K display. Just 1.3 kg.
            </p>

            <div className="hero-price-block">
              <div className="price-row">
                <span className="current-price">{formatINR(product.price)}</span>
                {product.mrp && <del className="original-mrp">{formatINR(product.mrp)}</del>}
                {saving && (
                  <span className="hero-saving-pill">
                    Save {formatINR(saving)}
                  </span>
                )}
              </div>
              <span className="price-caption">
                Direct manufacturer pricing · Free standard shipping included
              </span>
            </div>

            <div className="hero-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onExplore(product.id)}
                aria-label={`Explore specifications and detail for ${product.name}`}
              >
                <span>Explore Air 14</span>
                <span className="btn-arrow" aria-hidden="true">↗</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onQuickAdd(product.id)}
                aria-label={`Add ${product.name} to shopping bag`}
              >
                <span>Add to bag</span>
                <span className="btn-arrow" aria-hidden="true">+</span>
              </button>

              <a href="#assistant" className="btn btn-outline">
                Help me choose
              </a>
            </div>
          </div>

          {/* Right Column: Hardware Stage */}
          <div className="hero-stage-container" aria-label="Illustrative product showcase for NovaBook Air 14">
            <div className="stage-halo" aria-hidden="true" />
            <div className="stage-watermark" aria-hidden="true">AIR / 14</div>

            <div className="stage-device-shell">
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="hero-device-img"
                  loading="eager"
                />
              ) : (
                <div className="device" aria-hidden="true">
                  <div className="device-screen">
                    <span>{product.name}</span>
                  </div>
                  <div className="device-base" />
                </div>
              )}
            </div>

            <span className="stage-disclaimer">
              Product image coming soon · illustrative hardware model
            </span>
          </div>
        </div>

        {/* Hero Footer Meta Strip */}
        <div className="hero-meta-strip">
          <div className="hero-meta-item">
            <span className="meta-index">01 /</span>
            <span className="meta-text">Designed for your everyday extraordinary</span>
          </div>
          <div className="hero-meta-specs">
            <span>Core Ultra 5</span>
            <span className="meta-bullet">/</span>
            <span>16 GB RAM</span>
            <span className="meta-bullet">/</span>
            <span>512 GB SSD</span>
            <span className="meta-bullet">/</span>
            <span>14-inch 2.2K</span>
            <span className="meta-bullet">/</span>
            <span>1.3 kg</span>
            <span className="meta-bullet">/</span>
            <span>Up to 18 hrs video</span>
          </div>
        </div>
      </div>
    </section>
  );
};
