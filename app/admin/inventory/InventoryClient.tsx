"use client";

import { FormEvent, Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronDown,
  CircleAlert,
  Edit3,
  PackageCheck,
  Search,
  Settings2,
  TriangleAlert,
  X,
} from "lucide-react";

type InventoryProduct = {
  id: string;
  name: string;
  category: string | null;
  pricePaise: string;
  image: string;
  stockQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
};

type InventoryMovement = {
  id: string;
  productId: string;
  productName: string;
  orderId: string | null;
  movementType: string;
  quantityChange: number;
  stockBefore: number;
  stockAfter: number;
  reason: string;
  actor: string;
  createdAt: string;
};

type InventoryResponse = {
  lowStockThreshold: number;
  stats: {
    totalProducts: number;
    availableStock: number;
    lowStockProducts: number;
    outOfStockProducts: number;
  };
  categories: string[];
  products: InventoryProduct[];
  movements: InventoryMovement[];
};

type ProductStockForm = {
  action: "receive" | "adjust";
  quantity: string;
  reason: string;
};

function getStockStatus(quantity: number, threshold: number) {
  if (quantity <= 0) return { label: "Out of Stock", className: "out" };
  if (quantity <= threshold) return { label: "Low Stock", className: "low" };
  return { label: "In Stock", className: "in" };
}

function formatPrice(value: string) {
  return `₹${(Number(value) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatMovementType(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function InventoryClient() {
  const [inventory, setInventory] = useState<InventoryResponse | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [thresholdInput, setThresholdInput] = useState("");
  const [forms, setForms] = useState<Record<string, ProductStockForm>>({});
  const [idempotencyKeys, setIdempotencyKeys] = useState<Record<string, string>>({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingProductId, setSavingProductId] = useState<string | null>(null);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadInventory = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const params = new URLSearchParams({ search, category });
      const response = await fetch(`/api/admin/inventory?${params}`, {
        cache: "no-store",
        signal,
      });
      if (response.status === 401) {
        window.location.replace("/admin/login");
        return;
      }
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to load inventory.");
      }
      const result = data as InventoryResponse;
      setInventory(result);
      setThresholdInput(String(result.lowStockThreshold));
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load inventory.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => void loadInventory(controller.signal),
      search ? 220 : 0
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [loadInventory, search]);

  const visibleProducts = useMemo(
    () => inventory?.products ?? [],
    [inventory]
  );

  function getForm(productId: string): ProductStockForm {
    return forms[productId] ?? { action: "receive", quantity: "", reason: "" };
  }

  function updateForm(productId: string, patch: Partial<ProductStockForm>) {
    setForms((current) => ({
      ...current,
      [productId]: { ...getForm(productId), ...patch },
    }));
  }

  async function submitProductUpdate(
    event: FormEvent<HTMLFormElement>,
    product: InventoryProduct
  ) {
    event.preventDefault();
    const form = getForm(product.id);
    setSavingProductId(product.id);
    setError("");
    setNotice("");

    try {
      const idempotencyKey =
        idempotencyKeys[product.id] ?? crypto.randomUUID();
      if (!idempotencyKeys[product.id]) {
        setIdempotencyKeys((current) => ({
          ...current,
          [product.id]: idempotencyKey,
        }));
      }
      const response = await fetch("/api/admin/inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: form.action,
          productId: Number(product.id),
          expectedStock: product.stockQuantity,
          quantity: Number(form.quantity),
          reason: form.reason,
          idempotencyKey,
        }),
      });
      const data = await response.json();
      if (response.status === 401) {
        window.location.replace("/admin/login");
        return;
      }
      if (response.status === 409) {
        await loadInventory();
        setEditingProductId(null);
        throw new Error(
          data.message ??
            "Stock changed since this page loaded. Review the current quantity before trying again."
        );
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to update product stock.");
      }
      setNotice(`Stock updated for ${product.name}.`);
      setForms((current) => ({
        ...current,
        [product.id]: { ...form, quantity: "", reason: "" },
      }));
      setIdempotencyKeys((current) => {
        const next = { ...current };
        delete next[product.id];
        return next;
      });
      setEditingProductId(null);
      await loadInventory();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to update stock.");
    } finally {
      setSavingProductId(null);
    }
  }

  async function saveThreshold(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingThreshold(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/inventory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold: Number(thresholdInput) }),
      });
      const data = await response.json();
      if (response.status === 401) {
        window.location.replace("/admin/login");
        return;
      }
      if (!response.ok || !data.success) {
        throw new Error(data.message ?? "Unable to save the low-stock threshold.");
      }
      setNotice(`Low-stock alert set to ${data.settings.lowStockThreshold} units.`);
      await loadInventory();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save the threshold.");
    } finally {
      setSavingThreshold(false);
    }
  }

  return (
    <main className="inventory-admin-page">
      <header className="inventory-admin-header">
        <div>
          <Link className="inventory-back-link" href="/admin/orders">
            <ArrowLeft size={15} aria-hidden="true" /> Back to orders
          </Link>
          <p className="inventory-eyebrow">VELOURA STUDIO · ADMIN</p>
          <h1>Product inventory <span>♡</span></h1>
          <p>Keep every handmade treasure accounted for.</p>
        </div>
        <form className="inventory-threshold-form" onSubmit={saveThreshold}>
          <label htmlFor="low-stock-threshold">
            <Settings2 size={16} aria-hidden="true" />
            Low-stock alert at
          </label>
          <div>
            <input
              id="low-stock-threshold"
              type="number"
              min="0"
              max="1000000"
              step="1"
              value={thresholdInput}
              onChange={(event) => setThresholdInput(event.target.value)}
              required
            />
            <span>units</span>
            <button type="submit" disabled={savingThreshold || !inventory}>
              {savingThreshold ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </header>

      {error && <p className="inventory-alert error" role="alert">{error}</p>}
      {notice && <p className="inventory-alert success" role="status">{notice}</p>}

      <section className="inventory-summary" aria-label="Inventory summary">
        <article>
          <span className="inventory-summary-icon rose"><Boxes size={18} aria-hidden="true" /></span>
          <div><small>Total products</small><strong>{inventory?.stats.totalProducts ?? "—"}</strong></div>
        </article>
        <article>
          <span className="inventory-summary-icon sage"><PackageCheck size={18} aria-hidden="true" /></span>
          <div><small>Available stock</small><strong>{inventory?.stats.availableStock ?? "—"}</strong></div>
        </article>
        <article>
          <span className="inventory-summary-icon amber"><TriangleAlert size={18} aria-hidden="true" /></span>
          <div><small>Low-stock products</small><strong>{inventory?.stats.lowStockProducts ?? "—"}</strong></div>
        </article>
        <article>
          <span className="inventory-summary-icon muted"><ArrowDownLeft size={18} aria-hidden="true" /></span>
          <div><small>Out of stock</small><strong>{inventory?.stats.outOfStockProducts ?? "—"}</strong></div>
        </article>
      </section>

      {inventory && (inventory.stats.lowStockProducts > 0 || inventory.stats.outOfStockProducts > 0) && (
        <section className="inventory-stock-alerts" aria-label="Stock alerts">
          {inventory.stats.lowStockProducts > 0 && (
            <div className="inventory-stock-alert low">
              <span><TriangleAlert size={18} aria-hidden="true" /></span>
              <p>
                <strong>{inventory.stats.lowStockProducts} {inventory.stats.lowStockProducts === 1 ? "product needs" : "products need"} attention</strong>
                <small>Stock is at or below your {inventory.lowStockThreshold}-unit low-stock threshold.</small>
              </p>
            </div>
          )}
          {inventory.stats.outOfStockProducts > 0 && (
            <div className="inventory-stock-alert out">
              <span><CircleAlert size={18} aria-hidden="true" /></span>
              <p>
                <strong>{inventory.stats.outOfStockProducts} {inventory.stats.outOfStockProducts === 1 ? "product is" : "products are"} out of stock</strong>
                <small>These items cannot be purchased until stock is added.</small>
              </p>
            </div>
          )}
        </section>
      )}

      <section className="inventory-products-panel">
        <div className="inventory-panel-heading">
          <div>
            <p className="inventory-eyebrow">STOCK CONTROL</p>
            <h2>Product stock</h2>
            <p className="inventory-panel-description">Review availability and keep your handmade collection up to date.</p>
          </div>
          <span>{visibleProducts.length} {visibleProducts.length === 1 ? "product" : "products"}</span>
        </div>
        <div className="inventory-filters">
          <label className="inventory-search-field">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search products</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products…"
            />
          </label>
          <label className="inventory-category-field">
            <span className="sr-only">Filter by category</span>
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">All categories</option>
              {(inventory?.categories ?? []).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>

        {error && !inventory ? (
          <div className="inventory-empty">
            <h3>Inventory data is unavailable</h3>
            <p>Resolve the setup error above before managing product stock.</p>
          </div>
        ) : loading && !inventory ? (
          <div className="inventory-empty" role="status">Loading your inventory…</div>
        ) : visibleProducts.length === 0 ? (
          <div className="inventory-empty">
            <span aria-hidden="true">♡</span>
            <h3>{search || category ? "No matching products" : "No products yet"}</h3>
            <p>Products from your active catalogue will appear here.</p>
          </div>
        ) : (
          <div className="inventory-table-scroll" role="region" aria-label="Product inventory table" tabIndex={0}>
            <table className="inventory-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Category</th>
                  <th scope="col">Current stock</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
              {visibleProducts.map((product) => {
              const stock = getStockStatus(
                product.availableQuantity,
                inventory?.lowStockThreshold ?? 5
              );
              const form = getForm(product.id);
              return (
                <Fragment key={product.id}>
                  <tr className={editingProductId === product.id ? "is-editing" : ""}>
                    <td>
                      <div className="inventory-table-product">
                        <img src={product.image} alt="" loading="lazy" />
                        <div>
                          <strong>{product.name}</strong>
                          <small>{formatPrice(product.pricePaise)}</small>
                        </div>
                      </div>
                    </td>
                    <td><span className="inventory-category-pill">{product.category || "Uncategorized"}</span></td>
                    <td>
                      <strong className="inventory-current-stock">{product.availableQuantity}</strong>
                      <small className="inventory-stock-subtext">
                        available{product.reservedQuantity > 0 ? ` · ${product.reservedQuantity} reserved` : ""}
                      </small>
                    </td>
                    <td>
                      <span className={`inventory-stock-badge ${stock.className}`}>
                        <span aria-hidden="true" />
                        {stock.label}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`inventory-edit-button ${editingProductId === product.id ? "active" : ""}`}
                        aria-expanded={editingProductId === product.id}
                        aria-controls={`inventory-edit-${product.id}`}
                        onClick={() => {
                          setError("");
                          setNotice("");
                          setEditingProductId((current) => current === product.id ? null : product.id);
                          if (editingProductId !== product.id) {
                            setForms((current) => ({
                              ...current,
                              [product.id]: {
                                action: "adjust",
                                quantity: String(product.stockQuantity),
                                reason: "",
                              },
                            }));
                          }
                        }}
                      >
                        {editingProductId === product.id ? <X size={15} aria-hidden="true" /> : <Edit3 size={15} aria-hidden="true" />}
                        {editingProductId === product.id ? "Close" : "Edit stock"}
                        {editingProductId !== product.id && <ChevronDown size={14} aria-hidden="true" />}
                      </button>
                    </td>
                  </tr>
                  {editingProductId === product.id && (
                    <tr className="inventory-edit-row">
                      <td colSpan={5}>
                        <form
                          id={`inventory-edit-${product.id}`}
                          className="inventory-update-form"
                          onSubmit={(event) => void submitProductUpdate(event, product)}
                        >
                          <div className="inventory-edit-context">
                            <span className="inventory-edit-icon"><Edit3 size={16} aria-hidden="true" /></span>
                            <div>
                              <strong>Update {product.name}</strong>
                              <small>Current on-hand: {product.stockQuantity} · Available: {product.availableQuantity}</small>
                            </div>
                          </div>
                          <label>
                            Stock action
                            <select
                              value={form.action}
                              onChange={(event) => updateForm(product.id, {
                                action: event.target.value as ProductStockForm["action"],
                                quantity: event.target.value === "adjust" ? String(product.stockQuantity) : "",
                              })}
                            >
                              <option value="adjust">Set exact quantity</option>
                              <option value="receive">Add produced stock</option>
                            </select>
                          </label>
                          <label>
                            {form.action === "receive" ? "Units produced" : "New on-hand quantity"}
                            <input
                              type="number"
                              min={form.action === "receive" ? "1" : "0"}
                              max="1000000"
                              step="1"
                              value={form.quantity}
                              onChange={(event) => updateForm(product.id, { quantity: event.target.value })}
                              required
                            />
                          </label>
                          <label className="inventory-reason-field">
                            Reason
                            <input
                              type="text"
                              minLength={3}
                              maxLength={500}
                              value={form.reason}
                              onChange={(event) => updateForm(product.id, { reason: event.target.value })}
                              placeholder={form.action === "receive" ? "New batch completed" : "Stock count correction"}
                              required
                            />
                          </label>
                          <div className="inventory-edit-actions">
                            <button
                              className="inventory-cancel-button"
                              type="button"
                              onClick={() => setEditingProductId(null)}
                              disabled={savingProductId === product.id}
                            >
                              Cancel
                            </button>
                            <button type="submit" disabled={savingProductId === product.id}>
                              {savingProductId === product.id
                                ? <><span className="inventory-button-spinner" aria-hidden="true" /> Saving…</>
                                : <><Check size={15} aria-hidden="true" /> Save changes</>}
                            </button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
              })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="inventory-history-panel">
        <div className="inventory-panel-heading">
          <div>
            <p className="inventory-eyebrow">AUDIT TRAIL</p>
            <h2>Recent stock movements</h2>
          </div>
          <span>{inventory?.movements.length ?? 0} latest</span>
        </div>
        {error && !inventory ? (
          <div className="inventory-empty compact">Stock history is unavailable until inventory setup is complete.</div>
        ) : !inventory?.movements.length ? (
          <div className="inventory-empty compact">Stock additions and adjustments will be recorded here.</div>
        ) : (
          <div className="inventory-history-list">
            {inventory.movements.map((movement) => (
              <article key={movement.id}>
                <span className={`inventory-movement-icon ${movement.quantityChange > 0 ? "positive" : "negative"}`}>
                  {movement.quantityChange > 0
                    ? <ArrowUpRight size={16} aria-hidden="true" />
                    : <ArrowDownLeft size={16} aria-hidden="true" />}
                </span>
                <div>
                  <strong>{movement.productName}</strong>
                  <p>{formatMovementType(movement.movementType)} · {movement.reason}</p>
                  {movement.orderId && <small>Order #{movement.orderId}</small>}
                </div>
                <b className={movement.quantityChange > 0 ? "positive" : "negative"}>
                  {movement.quantityChange > 0 ? "+" : ""}{movement.quantityChange}
                </b>
                <time dateTime={movement.createdAt}>
                  {new Date(movement.createdAt).toLocaleString("en-IN", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
