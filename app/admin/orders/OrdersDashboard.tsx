"use client";

import { useEffect, useState } from "react";

type OrderItem = {
  productName: string;
  quantity: number;
  unitPricePaise: number;
};

type Order = {
  id: number;
  customer_name: string;
  phone: string;
  delivery_address: string;
  customization_notes: string | null;
  subtotal_paise: number;
  status: string;
  created_at: string;
  items: OrderItem[];
};

const statusOptions = [
  "pending",
  "confirmed",
  "preparing",
  "shipped",
  "delivered",
  "cancelled",
];

const statusStyles: Record<string, { background: string; color: string }> = {
  pending: { background: "#fff1d6", color: "#946200" },
  confirmed: { background: "#e8f0ff", color: "#315eaa" },
  preparing: { background: "#f1e8ff", color: "#7546a5" },
  shipped: { background: "#e1f3f0", color: "#267568" },
  delivered: { background: "#e3f5e5", color: "#26713b" },
  cancelled: { background: "#fde8e8", color: "#b42332" },
};

function formatRupees(paise: number | string) {
  return `₹${(Number(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  function redirectToLogin() {
    window.location.replace("/admin/login");
  }

  async function handleLogout() {
    setError("");

    try {
      const response = await fetch("/api/admin/logout", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to log out.");
      }

      window.location.replace("/admin/login");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while logging out."
      );
    }
  }

  async function updateOrderStatus(orderId: number, status: string) {
    setUpdatingOrderId(orderId);
    setError("");

    try {
      const response = await fetch("/api/admin/orders/status", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, status }),
      });

      if (response.status === 401) {
        redirectToLogin();
        return;
      }

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to update order status.");
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === orderId
            ? { ...order, status: data.order.status }
            : order
        )
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setUpdatingOrderId(null);
    }
  }

  useEffect(() => {
    let isActive = true;

    async function loadOrders() {
      try {
        const response = await fetch("/api/admin/orders", {
          cache: "no-store",
        });

        if (response.status === 401) {
          redirectToLogin();
          return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error(data.message || "Unable to load orders.");
        }

        if (isActive) {
          setOrders(data.orders);
        }
      } catch (err) {
        if (isActive) {
          setError(
            err instanceof Error ? err.message : "Something went wrong."
          );
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadOrders();

    return () => {
      isActive = false;
    };
  }, []);

  const totalValue = orders.reduce(
    (sum, order) => sum + Number(order.subtotal_paise),
    0
  );
  const normalizedSearch = searchQuery.trim().toLowerCase();

const filteredOrders = orders.filter((order) => {
  const query = searchQuery.trim().toLowerCase();

  if (!query) return true;

  // Match order ID specifically.
  // Searching "1" matches Order #1, not Order #10.
  const orderIdMatches =
    String(order.id) === query.replace(/^#/, "").trim();

  // Match customer name.
  const customerNameMatches = order.customer_name
    .toLowerCase()
    .includes(query);

  // Match phone number.
  const phoneMatches = order.phone
    .toLowerCase()
    .includes(query);

  // Match product names.
  const productMatches = order.items.some((item) =>
    item.productName.toLowerCase().includes(query)
  );

  return (
    orderIdMatches ||
    customerNameMatches ||
    phoneMatches ||
    productMatches
  );
});

  const deliveredCount = orders.filter(
    (order) => order.status === "delivered"
  ).length;

  const pendingCount = orders.filter(
    (order) => order.status === "pending"
  ).length;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#faf6f1] px-4 py-8 text-[#392c28] sm:px-6 lg:px-8">
      {/* Decorative background */}
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-[#ead8cb]/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 top-80 h-[28rem] w-[28rem] rounded-full bg-[#e9d4c5]/30 blur-3xl" />

      <div className="relative mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-10 flex flex-wrap items-center justify-between gap-5">
          <div>
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#ddc5b5] bg-white shadow-sm">
                <span className="font-serif text-xl italic text-[#896653]">
                  V
                </span>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#997762]">
                  Veloura Studio
                </p>
                <p className="mt-1 text-xs text-[#a39389]">
                  Your handmade business
                </p>
              </div>
            </div>

            <h1 className="font-serif text-3xl tracking-tight sm:text-4xl">
              Orders Dashboard <span className="text-[#b9828c]">♡</span>
            </h1>

            <p className="mt-2 text-sm text-[#8c7c73]">
              A little overview of everything happening in your studio.
            </p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-[#e5d2c7] bg-white px-5 py-3 text-sm font-medium text-[#80604f] shadow-sm transition hover:border-[#c9a697] hover:bg-[#fffaf7] focus:outline-none focus:ring-4 focus:ring-[#80604f]/10"
          >
            Log out <span className="ml-2">↗</span>
          </button>
        </header>

        {/* Error message */}
        {error && (
          <div
            role="alert"
            className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700"
          >
            <strong className="mr-2">Something went wrong.</strong>
            {error}
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <section
            className="rounded-3xl border border-[#eaded5] bg-white p-12 text-center shadow-sm"
            aria-live="polite"
          >
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-[#eaded5] border-t-[#96715d]" />
            <h2 className="font-serif text-2xl">Gathering your orders...</h2>
            <p className="mt-2 text-sm text-[#8c7c73]">
              Just a moment while we prepare your dashboard.
            </p>
          </section>
        ) : (
          <>
            {/* Summary cards */}
            <section
              aria-label="Order summary"
              className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              <SummaryCard
                label="Total orders"
                value={String(orders.length)}
                detail="All orders received"
                icon="♡"
              />

              <SummaryCard
                label="Total order value"
                value={formatRupees(totalValue)}
                detail="Combined value of all orders"
                icon="₹"
              />

              <SummaryCard
                label="Awaiting confirmation"
                value={String(pendingCount)}
                detail="Orders with pending status"
                icon="◷"
              />

              <SummaryCard
                label="Successfully delivered"
                value={String(deliveredCount)}
                detail="Orders marked delivered"
                icon="✓"
              />
            </section>

            {/* Orders heading */}
            <div className="mb-5 flex flex-col gap-5">
  <div className="flex flex-wrap items-end justify-between gap-3">
    <div>
      <h2 className="font-serif text-2xl">Recent orders</h2>
      <p className="mt-1 text-sm text-[#8c7c73]">
        Manage your customers and handmade creations.
      </p>
    </div>

    <span className="rounded-full border border-[#eaded5] bg-white px-4 py-2 text-xs font-medium text-[#80604f]">
      {filteredOrders.length} of {orders.length} orders
    </span>
  </div>

  <div className="relative">
    <label htmlFor="order-search" className="sr-only">
      Search orders
    </label>

    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-[#a39389]">
      ⌕
    </span>

    <input
      id="order-search"
      type="search"
      value={searchQuery}
      onChange={(event) => setSearchQuery(event.target.value)}
      placeholder="Search by order ID, customer, phone or product..."
      className="w-full rounded-2xl border border-[#eaded5] bg-white py-4 pl-12 pr-12 text-sm text-[#392c28] shadow-sm outline-none transition placeholder:text-[#b0a097] focus:border-[#b9828c] focus:ring-4 focus:ring-[#b9828c]/10"
    />

    {searchQuery && (
      <button
        type="button"
        onClick={() => setSearchQuery("")}
        aria-label="Clear search"
        className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-sm text-[#80604f] transition hover:bg-[#f8eee8]"
      >
        ✕
      </button>
    )}
  </div>
</div>

            {/* Empty state */}
            {/* Empty state and filtered order list */}
{orders.length === 0 ? (
  <section className="rounded-3xl border border-[#eaded5] bg-white px-6 py-16 text-center shadow-sm">
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#faf0eb] text-3xl text-[#a46d78]">
      ♡
    </div>

    <h3 className="font-serif text-2xl">Your story starts here</h3>

    <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#8c7c73]">
      No orders have been placed yet. New customer orders will appear here
      when they arrive.
    </p>
  </section>
) : filteredOrders.length === 0 ? (
  <section className="rounded-3xl border border-[#eaded5] bg-white px-6 py-14 text-center shadow-sm">
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#faf0eb] text-2xl text-[#a46d78]">
      ⌕
    </div>

    <h3 className="font-serif text-2xl">No matching orders</h3>

    <p className="mt-2 text-sm text-[#8c7c73]">
      Try another order ID, customer name, phone number, or product.
    </p>

    <button
      type="button"
      onClick={() => setSearchQuery("")}
      className="mt-5 rounded-xl bg-[#80604f] px-5 py-3 text-sm font-medium text-white transition hover:bg-[#694c3e]"
    >
      Clear search
    </button>
  </section>
) : (
  <section className="space-y-6">
    {filteredOrders.map((order) => {
      const badge =
        statusStyles[order.status] ?? statusStyles.pending;

      return (
        <article
          key={order.id}
          className="overflow-hidden rounded-3xl border border-[#eaded5] bg-white shadow-[0_8px_30px_rgba(87,60,45,0.05)] transition-shadow hover:shadow-[0_12px_35px_rgba(87,60,45,0.09)]"
        >
          {/* Order header */}
          <div className="flex flex-col gap-4 border-b border-[#f0e6df] bg-gradient-to-r from-[#fffaf7] to-white p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 sm:py-6">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="font-serif text-2xl">
                  Order #{order.id}
                </h3>

                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    background: badge.background,
                    color: badge.color,
                  }}
                >
                  {formatStatus(order.status)}
                </span>
              </div>

              <p className="mt-2 text-xs text-[#8c7c73]">
                Placed on{" "}
                {new Date(order.created_at).toLocaleString("en-IN", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:items-end">
              <label
                htmlFor={`status-${order.id}`}
                className="text-xs font-medium uppercase tracking-wider text-[#997762]"
              >
                Update order status
              </label>

              <select
                id={`status-${order.id}`}
                value={order.status}
                onChange={(event) =>
                  updateOrderStatus(order.id, event.target.value)
                }
                disabled={updatingOrderId === order.id}
                aria-label={`Update status for order ${order.id}`}
                className="w-full rounded-xl border border-[#e5d8cf] bg-white px-4 py-2.5 text-sm text-[#392c28] outline-none transition focus:border-[#96715d] focus:ring-4 focus:ring-[#96715d]/10 disabled:cursor-wait disabled:opacity-60 sm:w-52"
              >
                {statusOptions.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>

              {updatingOrderId === order.id && (
                <span
                  className="text-xs text-[#997762]"
                  aria-live="polite"
                >
                  Saving status...
                </span>
              )}
            </div>
          </div>

          {/* Order details */}
          <div className="grid grid-cols-1 gap-8 p-5 sm:p-7 lg:grid-cols-2">
            {/* Customer information */}
            <section>
              <h4 className="mb-4 flex items-center gap-2 font-serif text-xl">
                <span className="text-[#b9828c]">♡</span>
                Customer details
              </h4>

              <div className="space-y-4">
                <DetailRow
                  label="Customer name"
                  value={order.customer_name}
                />

                <DetailRow
                  label="Phone number"
                  value={order.phone}
                />

                <DetailRow
                  label="Delivery address"
                  value={order.delivery_address}
                />

                {order.customization_notes && (
                  <div className="rounded-2xl border border-[#f0e2dc] bg-[#fffaf7] p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#997762]">
                      Customization request
                    </p>

                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-[#51413a]">
                      {order.customization_notes}
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* Ordered products */}
            <section>
              <h4 className="mb-4 flex items-center gap-2 font-serif text-xl">
                <span className="text-[#b9828c]">✿</span>
                Order items
              </h4>

              <div className="space-y-3">
                {order.items.map((item, index) => (
                  <div
                    key={`${order.id}-${index}`}
                    className="flex items-start justify-between gap-4 rounded-2xl border border-[#f0e6df] bg-[#fffdfb] p-4"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-medium text-[#392c28]">
                        {item.productName}
                      </p>

                      <p className="mt-1 text-xs text-[#8c7c73]">
                        Quantity: {item.quantity}
                      </p>
                    </div>

                    <p className="shrink-0 text-sm font-semibold text-[#80604f]">
                      {formatRupees(
                        Number(item.unitPricePaise) * item.quantity
                      )}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-[#f8eee8] p-5">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#997762]">
                    Order total
                  </p>

                  <p className="mt-1 text-xs text-[#8c7c73]">
                    Including listed items
                  </p>
                </div>

                <p className="font-serif text-2xl font-semibold text-[#694c3e]">
                  {formatRupees(order.subtotal_paise)}
                </p>
              </div>
            </section>
          </div>
        </article>
      );
    })}
  </section>
)}

            {/* Footer */}
            <footer className="mt-10 border-t border-[#eaded5] py-6 text-center">
              <p className="font-serif text-lg text-[#80604f]">
                Made with care, for things made with love. ♡
              </p>
              <p className="mt-2 text-xs tracking-wide text-[#a39389]">
                © 2026 Veloura Studio · Admin Dashboard
              </p>
            </footer>
          </>
        )}
      </div>
    </main>
  );
}

function SummaryCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: string;
}) {
  return (
    <article className="rounded-3xl border border-[#eaded5] bg-white p-5 shadow-[0_6px_24px_rgba(87,60,45,0.04)] transition-transform duration-200 hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(87,60,45,0.08)] sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[#806f65]">{label}</p>

        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#f8eee8] font-serif text-xl text-[#a46d78]">
          {icon}
        </span>
      </div>

      <p className="break-words font-serif text-3xl tracking-tight text-[#392c28] sm:text-4xl">
        {value}
      </p>

      <p className="mt-2 text-xs leading-5 text-[#a39389]">{detail}</p>
    </article>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-[#997762]">
        {label}
      </p>
      <p className="break-words text-sm leading-6 text-[#51413a]">{value}</p>
    </div>
  );
}