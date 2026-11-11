"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Search,
  Users,
  UserRoundPlus,
  Repeat2,
  ShoppingBag,
} from "lucide-react";

type Customer = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  registeredAt: string;
  totalOrders: number;
  amountSpentPaise: string;
  lastPurchaseAt: string | null;
};

type CustomerResponse = {
  customers: Customer[];
  summary: {
    totalCustomers: number;
    newCustomers: number;
    repeatCustomers: number;
    totalCustomerOrders: number;
  };
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

function formatRupees(paise: string | number) {
  return `₹${(Number(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function CustomersDashboard() {
  const [data, setData] = useState<CustomerResponse | null>(null);
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [sort, setSort] = useState("recent");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadCustomers = useCallback(async (signal?: AbortSignal) => {
    setError("");
    try {
      const params = new URLSearchParams({
        search,
        segment,
        sort,
        page: String(page),
      });
      const response = await fetch(`/api/admin/customers?${params}`, {
        cache: "no-store",
        signal,
      });
      if (response.status === 401) {
        window.location.replace("/admin/login");
        return;
      }
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message ?? "Unable to load customer records.");
      }
      setData(result as CustomerResponse);
    } catch (loadError) {
      if (loadError instanceof Error && loadError.name === "AbortError") return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load customers.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [page, search, segment, sort]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => void loadCustomers(controller.signal),
      search ? 220 : 0
    );
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [loadCustomers, search]);

  function changeSegment(value: string) {
    setSegment(value);
    setPage(1);
  }

  function changeSort(value: string) {
    setSort(value);
    setPage(1);
  }

  const summaryCards = [
    { label: "Total customers", value: data?.summary.totalCustomers, icon: Users, tone: "rose" },
    { label: "New · last 30 days", value: data?.summary.newCustomers, icon: UserRoundPlus, tone: "gold" },
    { label: "Repeat customers", value: data?.summary.repeatCustomers, icon: Repeat2, tone: "green" },
    { label: "Customer orders", value: data?.summary.totalCustomerOrders, icon: ShoppingBag, tone: "lavender" },
  ];

  return (
    <main className="customer-admin-page">
      <header className="customer-admin-header">
        <div>
          <Link className="customer-back-link" href="/admin/orders">
            <ArrowLeft size={15} aria-hidden="true" /> Admin dashboard
          </Link>
          <p className="customer-eyebrow">VELOURA STUDIO · ADMIN</p>
          <h1>Customer care <span>♡</span></h1>
          <p>Get to know the people who make your handmade studio special.</p>
        </div>
        <nav className="customer-admin-links" aria-label="Admin sections">
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/inventory">Inventory</Link>
          <Link href="/admin/reviews">Reviews</Link>
        </nav>
      </header>

      {error && <div className="customer-page-error" role="alert">{error}</div>}

      <section className="customer-summary" aria-label="Customer statistics">
        {summaryCards.map(({ label, value, icon: Icon, tone }) => (
          <article key={label}>
            <span className={`customer-summary-icon ${tone}`}><Icon size={18} aria-hidden="true" /></span>
            <div><small>{label}</small><strong>{loading && !data ? "—" : (value ?? 0).toLocaleString("en-IN")}</strong></div>
          </article>
        ))}
      </section>

      <section className="customer-list-panel">
        <div className="customer-panel-heading">
          <div>
            <p className="customer-eyebrow">YOUR COMMUNITY</p>
            <h2>Customers</h2>
            <p>Account records and order activity in one place.</p>
          </div>
          <span>{data?.pagination.total ?? 0} {data?.pagination.total === 1 ? "customer" : "customers"}</span>
        </div>

        <div className="customer-filters">
          <label className="customer-search">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">Search customers</span>
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name, email or phone…"
            />
          </label>
          <label>
            <span className="sr-only">Filter customers</span>
            <select value={segment} onChange={(event) => changeSegment(event.target.value)}>
              <option value="all">All customers</option>
              <option value="new">New · last 30 days</option>
              <option value="repeat">Repeat · 2+ orders</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Sort customers</span>
            <select value={sort} onChange={(event) => changeSort(event.target.value)}>
              <option value="recent">Newest registered</option>
              <option value="oldest">Oldest registered</option>
              <option value="orders">Most orders</option>
              <option value="spent">Highest spend</option>
              <option value="name">Name A–Z</option>
            </select>
          </label>
        </div>

        {loading && !data ? (
          <div className="customer-empty-state" role="status">Loading customer records…</div>
        ) : error && !data ? (
          <div className="customer-empty-state">
            <h3>Customer records are unavailable</h3>
            <p>Try refreshing the page. No customer data was changed.</p>
          </div>
        ) : !data?.customers.length ? (
          <div className="customer-empty-state">
            <span aria-hidden="true">♡</span>
            <h3>{search || segment !== "all" ? "No matching customers" : "No registered customers yet"}</h3>
            <p>{search || segment !== "all" ? "Try a different search or filter." : "Registered customer accounts will appear here."}</p>
          </div>
        ) : (
          <>
            <div className="customer-table-scroll" role="region" aria-label="Customer records" tabIndex={0}>
              <table className="customer-table">
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Registered</th>
                    <th scope="col">Orders</th>
                    <th scope="col">Total spent</th>
                    <th scope="col">Profile</th>
                  </tr>
                </thead>
                <tbody>
                  {data.customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div className="customer-table-name">
                          <span>{customer.fullName.trim().charAt(0).toUpperCase() || "♡"}</span>
                          <div><strong>{customer.fullName}</strong><small>{customer.email}</small></div>
                        </div>
                      </td>
                      <td>{customer.phone || "—"}</td>
                      <td>{formatDate(customer.registeredAt)}</td>
                      <td><span className="customer-order-count">{customer.totalOrders}</span></td>
                      <td className="customer-spend">{formatRupees(customer.amountSpentPaise)}</td>
                      <td><Link className="customer-profile-link" href={`/admin/customers/${customer.id}`}>View profile</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="customer-pagination">
              <span>
                Showing {(data.pagination.page - 1) * data.pagination.pageSize + 1}–
                {Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.total)}
                {" "}of {data.pagination.total}
              </span>
              <div>
                <button
                  type="button"
                  aria-label="Previous page"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((value) => Math.max(1, value - 1))}
                ><ChevronLeft size={17} aria-hidden="true" /></button>
                <span>Page {page} of {data.pagination.totalPages}</span>
                <button
                  type="button"
                  aria-label="Next page"
                  disabled={page >= data.pagination.totalPages || loading}
                  onClick={() => setPage((value) => value + 1)}
                ><ChevronRight size={17} aria-hidden="true" /></button>
              </div>
            </div>
          </>
        )}
      </section>
      <p className="customer-data-note">
        New customers are those registered in the last 30 days; repeat customers have placed at least two linked orders.
      </p>
    </main>
  );
}
