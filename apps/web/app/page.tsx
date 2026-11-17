import Link from "next/link";
import styles from "./page.module.css";

const categories = [
  { name: "Laptops", label: "AI-ready workstations" },
  { name: "Desktops", label: "Performance towers" },
  { name: "All-in-ones", label: "Minimal desk setups" },
  { name: "Monitors", label: "Crisp, wide displays" },
  { name: "Accessories", label: "Boost your setup" },
];

const featuredProducts = [
  {
    name: "NovaBook Pro 14",
    price: "₹1,29,999",
    badge: "Most loved",
    summary: "16GB RAM · 1TB SSD · AI tuning",
  },
  {
    name: "NovaDesk X1",
    price: "₹99,999",
    badge: "New",
    summary: "RTX graphics · 32GB memory · quiet airflow",
  },
  {
    name: "NovaView 27",
    price: "₹34,999",
    badge: "Editor pick",
    summary: "4K panel · 144Hz refresh · USB-C hub",
  },
  {
    name: "NovaKey Pro",
    price: "₹8,499",
    badge: "Fast shipping",
    summary: "Mechanical wireless keyboard · low-latency",
  },
];

export default function Home() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.brandWrap}>
          <div className={styles.logoMark}>N</div>
          <div>
            <p className={styles.brand}>NovaTech</p>
            <span className={styles.brandTag}>Smart computing</span>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Main navigation">
          <Link href="/">Home</Link>
          <Link href="/search">Search</Link>
          <Link href="/search?category=Laptops">Laptops</Link>
          <Link href="/search?category=Monitors">Monitors</Link>
          <Link href="/search?category=Accessories">Accessories</Link>
        </nav>

        <div className={styles.headerActions}>
          <button type="button" className={styles.inlineButton}>Sign in</button>
          <Link href="/search" className={styles.primaryButton}>Shop now</Link>
        </div>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <p className={styles.eyebrow}>Built for everyday ambition</p>
            <h1>Explore tech that makes work and play feel effortless.</h1>
            <p className={styles.lead}>
              From premium laptops to focused desktop setups, NovaTech helps you find the right machine for your routine.
            </p>
            <div className={styles.heroActions}>
              <Link href="/search" className={styles.primaryButton}>Browse catalog</Link>
              <Link href="/search?category=Laptops" className={styles.secondaryButton}>View laptops</Link>
            </div>
            <ul className={styles.trustList}>
              <li>Free delivery over ₹2,000</li>
              <li>7-day easy returns</li>
              <li>Expert setup support</li>
            </ul>
          </div>

          <div className={styles.heroVisual} aria-label="Featured products showcase">
            <div className={styles.deviceCardLarge}>
              <div className={styles.deviceScreen}>
                <span>NovaBook Pro</span>
              </div>
              <div className={styles.deviceMeta}>
                <strong>14-inch AI laptop</strong>
                <span>₹1,29,999</span>
              </div>
            </div>
            <div className={styles.floatingBadge}>New season picks</div>
          </div>
        </section>

        <section className={styles.categorySection}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Popular categories</p>
              <h2>Find your ideal setup</h2>
            </div>
            <Link href="/search" className={styles.linkText}>Open full catalog</Link>
          </div>

          <div className={styles.categoryGrid}>
            {categories.map((category) => (
              <Link key={category.name} href={`/search?category=${encodeURIComponent(category.name)}`} className={styles.categoryCard}>
                <div className={styles.categoryIcon}>▣</div>
                <h3>{category.name}</h3>
                <p>{category.label}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.productSection}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Featured picks</p>
              <h2>Top-rated essentials</h2>
            </div>
            <Link href="/search" className={styles.linkText}>See all products</Link>
          </div>

          <div className={styles.productGrid}>
            {featuredProducts.map((product) => (
              <article key={product.name} className={styles.productCard}>
                <div className={styles.productVisual} aria-hidden="true" />
                <span className={styles.pill}>{product.badge}</span>
                <h3>{product.name}</h3>
                <p>{product.summary}</p>
                <div className={styles.productFooter}>
                  <strong>{product.price}</strong>
                  <button type="button">Add to cart</button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.assistantSection}>
          <article className={styles.assistantCard}>
            <p className={styles.eyebrow}>AI-A</p>
            <h3>Shopping assistant</h3>
            <p>Ask for the best laptop for everyday productivity, creators, students, or home office setups.</p>
          </article>
          <article className={styles.assistantCard}>
            <p className={styles.eyebrow}>AI-B</p>
            <h3>Policy assistant</h3>
            <p>Get grounded answers about delivery coverage, returns, exchange windows, and support eligibility.</p>
          </article>
        </section>
      </main>
    </div>
  );
}
