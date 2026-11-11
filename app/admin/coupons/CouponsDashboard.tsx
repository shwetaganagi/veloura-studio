"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgePercent,
  CalendarClock,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Edit3,
  Gift,
  Plus,
  Search,
  TicketPercent,
  Trash2,
  X,
} from "lucide-react";

type CouponStatus = "active" | "inactive" | "expired" | "scheduled" | "used_up";
type Coupon = {
  id: string;
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minimumOrderPaise: string;
  maximumDiscountPaise: string | null;
  startsAt: string;
  expiresAt: string;
  usageLimit: number | null;
  perCustomerLimit: number;
  isActive: boolean;
  usedCount: number;
  discountGivenPaise: string;
  status: CouponStatus;
};
type CouponSummary = {
  totalCoupons: number;
  activeCoupons: number;
  expiredCoupons: number;
  totalDiscountsPaise: string;
};
type CouponForm = {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: string;
  minimumOrder: string;
  maximumDiscount: string;
  startsAt: string;
  expiresAt: string;
  usageLimit: string;
  perCustomerLimit: string;
  isActive: boolean;
};

const EMPTY_FORM: CouponForm = {
  code: "",
  discountType: "percentage",
  discountValue: "",
  minimumOrder: "0",
  maximumDiscount: "",
  startsAt: "",
  expiresAt: "",
  usageLimit: "",
  perCustomerLimit: "1",
  isActive: true,
};

function formatRupees(paise: string | number) {
  return `₹${(Number(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function dateTimeLocal(value: string) {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(status: CouponStatus) {
  return {
    active: "Active",
    inactive: "Inactive",
    expired: "Expired",
    scheduled: "Scheduled",
    used_up: "Usage limit reached",
  }[status];
}

export default function CouponsDashboard() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [summary, setSummary] = useState<CouponSummary | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingCouponId, setEditingCouponId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [busyCouponId, setBusyCouponId] = useState<string | null>(null);

  const loadCoupons = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const params = new URLSearchParams({ search, status: statusFilter });
      const response = await fetch(`/api/admin/coupons?${params}`, {
        cache: "no-store",
        signal,
      });
      if (response.status === 401) {
        window.location.replace("/admin/login");
        return;
      }
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to load coupons.");
      }
      setCoupons(result.coupons as Coupon[]);
      setSummary(result.summary as CouponSummary);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load coupons.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => void loadCoupons(controller.signal),
      search ? 220 : 0
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [loadCoupons, search]);

  function startCreate() {
    setEditingCouponId(null);
    setForm({
      ...EMPTY_FORM,
      startsAt: dateTimeLocal(new Date().toISOString()),
      expiresAt: dateTimeLocal(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()),
    });
    setError("");
    setNotice("");
  }

  function startEdit(coupon: Coupon) {
    setEditingCouponId(coupon.id);
    setForm({
      code: coupon.code,
      discountType: coupon.discountType,
      discountValue:
        coupon.discountType === "percentage"
          ? String(coupon.discountValue)
          : (coupon.discountValue / 100).toFixed(2),
      minimumOrder: (Number(coupon.minimumOrderPaise) / 100).toFixed(2),
      maximumDiscount:
        coupon.maximumDiscountPaise === null
          ? ""
          : (Number(coupon.maximumDiscountPaise) / 100).toFixed(2),
      startsAt: dateTimeLocal(coupon.startsAt),
      expiresAt: dateTimeLocal(coupon.expiresAt),
      usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
      perCustomerLimit: String(coupon.perCustomerLimit),
      isActive: coupon.isActive,
    });
    setError("");
    setNotice("");
  }

  function updateForm(patch: Partial<CouponForm>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  async function submitCoupon(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/coupons", {
        method: editingCouponId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editingCouponId ? { id: editingCouponId } : {}),
          ...form,
          code: form.code.toUpperCase(),
          startsAt: new Date(form.startsAt).toISOString(),
          expiresAt: new Date(form.expiresAt).toISOString(),
          usageLimit: form.usageLimit || null,
        }),
      });
      if (response.status === 401) {
        window.location.replace("/admin/login");
        return;
      }
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to save coupon.");
      }
      setNotice(editingCouponId ? "Coupon updated successfully." : "Coupon created successfully.");
      setEditingCouponId(null);
      setForm(EMPTY_FORM);
      await loadCoupons();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save coupon.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(coupon: Coupon) {
    setBusyCouponId(coupon.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/coupons", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: coupon.id,
          code: coupon.code,
          discountType: coupon.discountType,
          discountValue:
            coupon.discountType === "percentage"
              ? String(coupon.discountValue)
              : (coupon.discountValue / 100).toFixed(2),
          minimumOrder: (Number(coupon.minimumOrderPaise) / 100).toFixed(2),
          maximumDiscount:
            coupon.maximumDiscountPaise === null
              ? ""
              : (Number(coupon.maximumDiscountPaise) / 100).toFixed(2),
          startsAt: coupon.startsAt,
          expiresAt: coupon.expiresAt,
          usageLimit: coupon.usageLimit === null ? "" : String(coupon.usageLimit),
          perCustomerLimit: String(coupon.perCustomerLimit),
          isActive: !coupon.isActive,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to update coupon.");
      }
      setNotice(coupon.isActive ? "Coupon deactivated." : "Coupon activated.");
      await loadCoupons();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Unable to update coupon.");
    } finally {
      setBusyCouponId(null);
    }
  }

  async function deleteCoupon(coupon: Coupon) {
    if (!window.confirm(`Delete ${coupon.code}? Coupons with redemption history must be deactivated instead.`)) {
      return;
    }
    setBusyCouponId(coupon.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/coupons?id=${encodeURIComponent(coupon.id)}`, {
        method: "DELETE",
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to delete coupon.");
      }
      setNotice(`${coupon.code} deleted.`);
      await loadCoupons();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Unable to delete coupon.");
    } finally {
      setBusyCouponId(null);
    }
  }

  const summaryCards = [
    { label: "Total Coupons", value: summary?.totalCoupons ?? 0, icon: TicketPercent, tone: "rose" },
    { label: "Active Coupons", value: summary?.activeCoupons ?? 0, icon: BadgePercent, tone: "green" },
    { label: "Expired Coupons", value: summary?.expiredCoupons ?? 0, icon: Clock3, tone: "gold" },
    { label: "Total Discounts Given", value: formatRupees(summary?.totalDiscountsPaise ?? 0), icon: CircleDollarSign, tone: "lavender" },
  ];

  return (
    <main className="coupon-admin-page">
      <header className="coupon-admin-header">
        <div>
          <Link className="coupon-back-link" href="/admin/orders">
            <ArrowLeft size={15} aria-hidden="true" /> Admin dashboard
          </Link>
          <p className="coupon-eyebrow">VELOURA STUDIO · ADMIN</p>
          <h1>Coupons & offers <span>♡</span></h1>
          <p>Thoughtful little offers for your Veloura community.</p>
        </div>
        <nav className="coupon-admin-links" aria-label="Admin sections">
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/customers">Customers</Link>
          <Link href="/admin/inventory">Inventory</Link>
          <Link href="/admin/reviews">Reviews</Link>
        </nav>
      </header>

      {error && <div className="coupon-message error" role="alert">{error}</div>}
      {notice && <div className="coupon-message success" role="status">{notice}</div>}

      <section className="coupon-summary" aria-label="Coupon statistics">
        {summaryCards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label}>
            <span className={`coupon-summary-icon ${tone}`}><Icon size={18} aria-hidden="true" /></span>
            <div><small>{label}</small><strong>{loading && !summary ? "—" : value}</strong></div>
          </article>
        ))}
      </section>

      <section className="coupon-panel">
        <div className="coupon-panel-heading">
          <div>
            <p className="coupon-eyebrow">OFFER COLLECTION</p>
            <h2>Manage coupons</h2>
            <p>Create, update and track every customer offer.</p>
          </div>
          <button type="button" className="coupon-primary-button" onClick={startCreate}>
            <Plus size={16} aria-hidden="true" /> New coupon
          </button>
        </div>

        {editingCouponId !== null || form.startsAt ? (
          <form className="coupon-form" onSubmit={(event) => void submitCoupon(event)}>
            <div className="coupon-form-heading">
              <div><Gift size={18} /><h3>{editingCouponId ? "Edit coupon" : "Create a coupon"}</h3></div>
              <button type="button" className="coupon-close-button" aria-label="Close coupon form" onClick={() => { setEditingCouponId(null); setForm(EMPTY_FORM); }}>
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            <div className="coupon-form-grid">
              <label>
                Coupon code
                <input
                  type="text"
                  value={form.code}
                  onChange={(event) => updateForm({ code: event.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40) })}
                  minLength={3}
                  maxLength={40}
                  pattern="[A-Z0-9][A-Z0-9_-]{2,39}"
                  placeholder="e.g. VELORA10"
                  required
                />
              </label>
              <label>
                Discount type
                <select
                  value={form.discountType}
                  onChange={(event) => updateForm({ discountType: event.target.value as CouponForm["discountType"], discountValue: "" })}
                >
                  <option value="percentage">Percentage</option>
                  <option value="fixed">Fixed amount</option>
                </select>
              </label>
              <label>
                {form.discountType === "percentage" ? "Discount (%)" : "Discount amount (₹)"}
                <input
                  type="number"
                  min={form.discountType === "percentage" ? "1" : "0.01"}
                  max={form.discountType === "percentage" ? "100" : "9999999.99"}
                  step={form.discountType === "percentage" ? "1" : "0.01"}
                  value={form.discountValue}
                  onChange={(event) => updateForm({ discountValue: event.target.value })}
                  required
                />
              </label>
              <label>
                Minimum order (₹)
                <input type="number" min="0" max="9999999.99" step="0.01" value={form.minimumOrder} onChange={(event) => updateForm({ minimumOrder: event.target.value })} required />
              </label>
              <label>
                Maximum discount (₹)
                <input type="number" min="0.01" max="9999999.99" step="0.01" value={form.maximumDiscount} onChange={(event) => updateForm({ maximumDiscount: event.target.value })} placeholder="No cap" />
              </label>
              <label>
                Total usage limit
                <input type="number" min="1" max="1000000" step="1" value={form.usageLimit} onChange={(event) => updateForm({ usageLimit: event.target.value })} placeholder="Unlimited" />
              </label>
              <label>
                Per-customer limit
                <input type="number" min="1" max="1000000" step="1" value={form.perCustomerLimit} onChange={(event) => updateForm({ perCustomerLimit: event.target.value })} required />
              </label>
              <label>
                Starts at
                <input type="datetime-local" value={form.startsAt} onChange={(event) => updateForm({ startsAt: event.target.value })} required />
              </label>
              <label>
                Expires at
                <input type="datetime-local" value={form.expiresAt} onChange={(event) => updateForm({ expiresAt: event.target.value })} required />
              </label>
              <label className="coupon-active-toggle">
                <input type="checkbox" checked={form.isActive} onChange={(event) => updateForm({ isActive: event.target.checked })} />
                <span>Coupon is active</span>
              </label>
            </div>
            <div className="coupon-form-actions">
              <button type="button" className="coupon-secondary-button" onClick={() => { setEditingCouponId(null); setForm(EMPTY_FORM); }} disabled={saving}>Cancel</button>
              <button type="submit" className="coupon-primary-button" disabled={saving}>
                {saving ? "Saving…" : <><Check size={15} aria-hidden="true" /> {editingCouponId ? "Save changes" : "Create coupon"}</>}
              </button>
            </div>
          </form>
        ) : null}

        <div className="coupon-filters">
          <label>
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search coupons</span>
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search coupon code…" />
          </label>
          <label>
            <span className="sr-only">Filter coupons</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="active">Active now</option>
              <option value="scheduled">Scheduled</option>
              <option value="used_up">Usage limit reached</option>
              <option value="expired">Expired</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <span className="coupon-count">{coupons.length} {coupons.length === 1 ? "coupon" : "coupons"}</span>
        </div>

        {loading && !summary ? (
          <div className="coupon-empty-state" role="status">Loading coupons…</div>
        ) : error && !summary ? (
          <div className="coupon-empty-state">
            <h3>Coupons are unavailable</h3>
            <p>{error}</p>
          </div>
        ) : coupons.length === 0 ? (
          <div className="coupon-empty-state">
            <span aria-hidden="true">♡</span>
            <h3>{search || statusFilter !== "all" ? "No matching coupons" : "No offers yet"}</h3>
            <p>{search || statusFilter !== "all" ? "Try another search or status filter." : "Create your first coupon to share a special offer."}</p>
          </div>
        ) : (
          <div className="coupon-table-scroll" role="region" aria-label="Coupons and redemption history" tabIndex={0}>
            <table className="coupon-table">
              <thead>
                <tr>
                  <th scope="col">Offer</th>
                  <th scope="col">Discount</th>
                  <th scope="col">Validity</th>
                  <th scope="col">Usage</th>
                  <th scope="col">Discounts given</th>
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {coupons.map((coupon) => {
                  const discountText =
                    coupon.discountType === "percentage"
                      ? `${coupon.discountValue}% off`
                      : `${formatRupees(coupon.discountValue)} off`;
                  return (
                    <tr key={coupon.id}>
                      <td><div className="coupon-code-cell"><span><TicketPercent size={17} /></span><div><strong>{coupon.code}</strong><small>Min. order {formatRupees(coupon.minimumOrderPaise)}{coupon.maximumDiscountPaise ? ` · Max ${formatRupees(coupon.maximumDiscountPaise)}` : ""}</small></div></div></td>
                      <td><strong className="coupon-discount-value">{discountText}</strong></td>
                      <td><div className="coupon-validity"><span><CalendarClock size={14} /> {formatDate(coupon.startsAt)}</span><span>to {formatDate(coupon.expiresAt)}</span></div></td>
                      <td>{coupon.usedCount}{coupon.usageLimit === null ? " / ∞" : ` / ${coupon.usageLimit}`}<small className="coupon-subline">{coupon.perCustomerLimit} per customer</small></td>
                      <td>{formatRupees(coupon.discountGivenPaise)}</td>
                      <td><span className={`coupon-status ${coupon.status}`}>{statusLabel(coupon.status)}</span></td>
                      <td>
                        <div className="coupon-actions">
                          <button type="button" aria-label={`Edit ${coupon.code}`} onClick={() => startEdit(coupon)} disabled={busyCouponId === coupon.id}><Edit3 size={15} /></button>
                          <button type="button" aria-label={`${coupon.isActive ? "Deactivate" : "Activate"} ${coupon.code}`} onClick={() => void toggleActive(coupon)} disabled={busyCouponId === coupon.id}><ChevronDown size={15} /></button>
                          <button type="button" aria-label={`Delete ${coupon.code}`} onClick={() => void deleteCoupon(coupon)} disabled={busyCouponId === coupon.id}><Trash2 size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="coupon-footnote">Usage counts include completed redemptions and active Razorpay checkout reservations. Expired or failed payment holds do not consume coupon usage.</p>
    </main>
  );
}
