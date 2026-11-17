"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import styles from "./admin.module.css";

interface Category {
  id: string;
  name: string;
  slug: string;
}
interface Product {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  brand: string | null;
  color: string | null;
  images: string[];
  tags: string[];
  stockCount: number;
  inStock: boolean;
  categoryId: string | null;
  category: Category | null;
}
interface ListResponse {
  data: Product[];
  brands: string[];
  pagination: { total: number; page: number; totalPages: number };
}

const SORTS = [
  ["updated_desc", "Recently updated"],
  ["newest", "Newest"],
  ["title_asc", "Title A–Z"],
  ["price_asc", "Price: low to high"],
  ["price_desc", "Price: high to low"],
  ["stock_asc", "Stock: low to high"],
  ["stock_desc", "Stock: high to low"],
] as const;

type Draft = {
  title: string;
  description: string;
  price: string;
  stockCount: string;
  brand: string;
  color: string;
  images: string;
  tags: string;
  categoryId: string;
};

const emptyDraft: Draft = { title: "", description: "", price: "", stockCount: "0", brand: "", color: "", images: "", tags: "", categoryId: "" };

const toDraft = (p: Product): Draft => ({
  title: p.title,
  description: p.description,
  price: String(p.price),
  stockCount: String(p.stockCount),
  brand: p.brand ?? "",
  color: p.color ?? "",
  images: p.images.join("\n"),
  tags: p.tags.join(", "),
  categoryId: p.categoryId ?? "",
});

const fromDraft = (d: Draft) => ({
  title: d.title,
  description: d.description,
  price: Number(d.price),
  stockCount: Number(d.stockCount),
  brand: d.brand.trim() || null,
  color: d.color.trim() || null,
  images: d.images.split("\n").map((s) => s.trim()).filter(Boolean),
  tags: d.tags.split(",").map((s) => s.trim()).filter(Boolean),
  categoryId: d.categoryId || null,
});

export default function AdminProducts() {
  const { getToken } = useAuth();
  const [filters, setFilters] = useState({ q: "", category: "", brand: "", stock: "", sortBy: "updated_desc", page: 1 });
  const [list, setList] = useState<ListResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editing, setEditing] = useState<{ id: string | null; draft: Draft } | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const call = useCallback(async <T,>(path: string, init?: RequestInit) => api<T>(path, await getToken(), init), [getToken]);

  const load = useCallback(async () => {
    const qs = new URLSearchParams({ sortBy: filters.sortBy, page: String(filters.page), limit: "20" });
    if (filters.q) qs.set("q", filters.q);
    if (filters.category) qs.set("category", filters.category);
    if (filters.brand) qs.set("brand", filters.brand);
    if (filters.stock === "in") qs.set("inStock", "true");
    if (filters.stock === "out") qs.set("inStock", "false");
    if (filters.stock === "low") qs.set("lowStock", "5");
    try {
      setList(await call<ListResponse>(`/api/admin/products?${qs}`));
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  }, [call, filters]);

  useEffect(() => {
    const t = setTimeout(load, 250); // debounce typing in the search box
    return () => clearTimeout(t);
  }, [load]);

  useEffect(() => {
    call<{ data: Category[] }>("/api/admin/categories").then((r) => setCategories(r.data)).catch(() => {});
  }, [call]);

  const setFilter = (patch: Partial<typeof filters>) => setFilters((f) => ({ ...f, ...patch, page: patch.page ?? 1 }));

  async function run(action: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      setNotice(success);
      setTimeout(() => setNotice(""), 2500);
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!editing) return;
    const body = JSON.stringify(fromDraft(editing.draft));
    const ok = await run(
      () => (editing.id ? call(`/api/admin/products/${editing.id}`, { method: "PATCH", body }) : call("/api/admin/products", { method: "POST", body })),
      editing.id ? "Product updated" : "Product created",
    );
    if (ok) setEditing(null);
  }

  const adjustStock = (p: Product, delta: number) =>
    run(() => call(`/api/admin/products/${p.id}/stock`, { method: "PATCH", body: JSON.stringify({ delta }) }), `Stock ${delta > 0 ? "+" : ""}${delta}`);

  const remove = (p: Product) => {
    if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;
    void run(() => call(`/api/admin/products/${p.id}`, { method: "DELETE" }), "Product deleted");
  };

  const d = editing?.draft;
  const field = (key: keyof Draft) => ({
    value: d?.[key] ?? "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setEditing((ed) => (ed ? { ...ed, draft: { ...ed.draft, [key]: e.target.value } } : ed)),
  });

  return (
    <section className={styles.panel}>
      <div className={styles.toolbar}>
        <input placeholder="Search title, slug, brand…" value={filters.q} onChange={(e) => setFilter({ q: e.target.value })} />
        <select value={filters.category} onChange={(e) => setFilter({ category: e.target.value })}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.name}</option>
          ))}
        </select>
        <select value={filters.brand} onChange={(e) => setFilter({ brand: e.target.value })}>
          <option value="">All brands</option>
          {list?.brands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
        <select value={filters.stock} onChange={(e) => setFilter({ stock: e.target.value })}>
          <option value="">Any stock</option>
          <option value="in">In stock</option>
          <option value="out">Out of stock</option>
          <option value="low">Low stock (≤ 5)</option>
        </select>
        <select value={filters.sortBy} onChange={(e) => setFilter({ sortBy: e.target.value })}>
          {SORTS.map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
        <button className={styles.primary} onClick={() => setEditing({ id: null, draft: emptyDraft })}>+ New product</button>
      </div>

      {error && <p className={styles.error}>{error}</p>}
      {notice && <p className={styles.notice}>{notice}</p>}

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th />
              <th>Product</th>
              <th>Category</th>
              <th className={styles.num}>Price</th>
              <th className={styles.num}>Stock</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list?.data.map((p) => (
              <tr key={p.id}>
                <td>{p.images[0] ? <img className={styles.thumb} src={p.images[0]} alt="" /> : <div className={styles.thumb} />}</td>
                <td>
                  <div className={styles.title}>{p.title}</div>
                  <div className={styles.muted}>{p.brand ?? "—"} · {p.slug}</div>
                </td>
                <td>{p.category?.name ?? "—"}</td>
                <td className={styles.num}>{p.price.toFixed(2)}</td>
                <td className={styles.num}>
                  <div className={styles.stock}>
                    <button disabled={busy || p.stockCount === 0} onClick={() => adjustStock(p, -1)} aria-label="Decrease stock">−</button>
                    <span className={p.stockCount === 0 ? styles.out : p.stockCount <= 5 ? styles.low : ""}>{p.stockCount}</span>
                    <button disabled={busy} onClick={() => adjustStock(p, 1)} aria-label="Increase stock">+</button>
                  </div>
                </td>
                <td className={styles.actions}>
                  <button onClick={() => setEditing({ id: p.id, draft: toDraft(p) })}>Edit</button>
                  <button className={styles.danger} onClick={() => remove(p)}>Delete</button>
                </td>
              </tr>
            ))}
            {list && list.data.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.empty}>No products match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {list && list.pagination.totalPages > 1 && (
        <div className={styles.pager}>
          <button disabled={filters.page <= 1} onClick={() => setFilter({ page: filters.page - 1 })}>Previous</button>
          <span>Page {list.pagination.page} of {list.pagination.totalPages} · {list.pagination.total} products</span>
          <button disabled={filters.page >= list.pagination.totalPages} onClick={() => setFilter({ page: filters.page + 1 })}>Next</button>
        </div>
      )}

      {editing && (
        <div className={styles.overlay} onClick={() => !busy && setEditing(null)}>
          <form className={styles.dialog} onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); void save(); }}>
            <h2>{editing.id ? "Edit product" : "New product"}</h2>
            <label>Title<input required {...field("title")} /></label>
            <label>Description<textarea required rows={4} {...field("description")} /></label>
            <div className={styles.row}>
              <label>Price<input required type="number" min="0" step="0.01" {...field("price")} /></label>
              <label>Stock<input required type="number" min="0" step="1" {...field("stockCount")} /></label>
            </div>
            <div className={styles.row}>
              <label>Brand<input {...field("brand")} /></label>
              <label>Color<input {...field("color")} /></label>
            </div>
            <label>Category
              <select {...field("categoryId")}>
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </label>
            <label>Image URLs (one per line)<textarea rows={3} {...field("images")} /></label>
            {d?.images.split("\n").filter((s) => s.trim()).length ? (
              <div className={styles.previews}>
                {d.images.split("\n").map((s) => s.trim()).filter(Boolean).map((src) => <img key={src} src={src} alt="" />)}
              </div>
            ) : null}
            <label>Tags (comma separated)<input {...field("tags")} /></label>
            <div className={styles.dialogActions}>
              <button type="button" disabled={busy} onClick={() => setEditing(null)}>Cancel</button>
              <button type="submit" className={styles.primary} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
