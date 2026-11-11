"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, PackageCheck, ShoppingBag, UserRound } from "lucide-react";

type CustomerProfileData = {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  registeredAt: string;
  totalOrders: number;
  amountSpentPaise: string;
  lastPurchaseAt: string | null;
};

type CustomerOrder = {
  id: string;
  customerName: string;
  phone: string;
  deliveryAddress: string;
  subtotalPaise: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  createdAt: string;
  items: { productName: string; quantity: number; unitPricePaise: number }[];
};

type CustomerProfileResponse = {
  customer: CustomerProfileData;
  orders: CustomerOrder[];
  addresses: { address: string; lastUsedAt: string; orderCount: number }[];
};

function formatRupees(paise: string | number) {
  return `₹${(Number(paise) / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null) {
  if (!value) return "No purchases yet";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function readableStatus(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function CustomerProfile({ customerId }: { customerId: string }) {
  const [data, setData] = useState<CustomerProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function loadProfile() {
      try {
        const response = await fetch(`/api/admin/customers/${customerId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.status === 401) {
          window.location.replace("/admin/login");
          return;
        }
        const result = await response.json();
        if (!response.ok || !result.success) {
          throw new Error(result.message ?? "Unable to load this customer profile.");
        }
        setData(result as CustomerProfileResponse);
      } catch (loadError) {
        if (loadError instanceof Error && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load customer profile.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadProfile();
    return () => controller.abort();
  }, [customerId]);

  if (loading) {
    return <main className="customer-admin-page"><div className="customer-empty-state" role="status">Loading customer profile…</div></main>;
  }
  if (error || !data) {
    return (
      <main className="customer-admin-page">
        <Link className="customer-back-link" href="/admin/customers"><ArrowLeft size={15} /> Back to customers</Link>
        <div className="customer-empty-state customer-profile-error" role="alert">
          <h2>{error || "Customer not found"}</h2>
          <p>This profile could not be loaded. Customer data has not been changed.</p>
        </div>
      </main>
    );
  }

  const { customer, orders, addresses } = data;
  return (
    <main className="customer-admin-page">
      <header className="customer-admin-header customer-profile-header">
        <div>
          <Link className="customer-back-link" href="/admin/customers">
            <ArrowLeft size={15} aria-hidden="true" /> Back to customers
          </Link>
          <p className="customer-eyebrow">CUSTOMER PROFILE</p>
          <h1>{customer.fullName} <span>♡</span></h1>
          <p>Customer since {formatDate(customer.registeredAt)}</p>
        </div>
        <Link className="customer-admin-button" href="/admin/orders">Admin dashboard</Link>
      </header>

      <section className="customer-profile-summary" aria-label="Customer purchase summary">
        <article><span><ShoppingBag size={18} /></span><div><small>Total orders</small><strong>{customer.totalOrders}</strong></div></article>
        <article><span><PackageCheck size={18} /></span><div><small>Total purchases</small><strong>{formatRupees(customer.amountSpentPaise)}</strong></div></article>
        <article><span><CalendarDays size={18} /></span><div><small>Last purchase</small><strong>{formatDate(customer.lastPurchaseAt)}</strong></div></article>
      </section>

      <div className="customer-profile-grid">
        <section className="customer-detail-panel">
          <div className="customer-detail-heading"><UserRound size={18} /><h2>Contact details</h2></div>
          <dl>
            <div><dt>Name</dt><dd>{customer.fullName}</dd></div>
            <div><dt>Email</dt><dd><a href={`mailto:${customer.email}`}>{customer.email}</a></dd></div>
            <div><dt>Phone</dt><dd>{customer.phone ? <a href={`tel:${customer.phone}`}>{customer.phone}</a> : "Not provided"}</dd></div>
            <div><dt>Registered</dt><dd>{formatDate(customer.registeredAt)}</dd></div>
          </dl>
        </section>

        <section className="customer-detail-panel">
          <div className="customer-detail-heading"><MapPin size={18} /><h2>Delivery address history</h2></div>
          {!addresses.length ? (
            <div className="customer-inline-empty">No delivery addresses are recorded on this customer’s orders.</div>
          ) : (
            <ul className="customer-address-list">
              {addresses.map((entry) => (
                <li key={entry.address}>
                  <p>{entry.address}</p>
                  <small>Used on {entry.orderCount} {entry.orderCount === 1 ? "order" : "orders"} · Last used {formatDate(entry.lastUsedAt)}</small>
                </li>
              ))}
            </ul>
          )}
          <p className="customer-address-note">Addresses are taken from order history; the current account system does not store a separate address book.</p>
        </section>
      </div>

      <section className="customer-orders-panel">
        <div className="customer-panel-heading">
          <div><p className="customer-eyebrow">PURCHASE HISTORY</p><h2>Orders</h2></div>
          <span>{orders.length} {orders.length === 1 ? "order" : "orders"}</span>
        </div>
        {!orders.length ? (
          <div className="customer-empty-state">
            <span aria-hidden="true">♡</span>
            <h3>No orders yet</h3>
            <p>Orders placed while signed in will appear here.</p>
          </div>
        ) : (
          <div className="customer-order-list">
            {orders.map((order) => (
              <article className="customer-order-card" key={order.id}>
                <div className="customer-order-topline">
                  <div><strong>Order #{order.id}</strong><time dateTime={order.createdAt}>{formatDate(order.createdAt)}</time></div>
                  <strong className="customer-order-total">{formatRupees(order.subtotalPaise)}</strong>
                </div>
                <div className="customer-order-badges">
                  <span className={`customer-status-badge ${order.status}`}>{readableStatus(order.status)}</span>
                  <span className={`customer-status-badge payment ${order.paymentStatus}`}>{readableStatus(order.paymentStatus)}</span>
                  {order.paymentMethod && <small>{readableStatus(order.paymentMethod)}</small>}
                </div>
                <ul>
                  {order.items.map((item, index) => (
                    <li key={`${order.id}-${index}`}>
                      <span>{item.productName} × {item.quantity}</span>
                      <span>{formatRupees(item.unitPricePaise * item.quantity)}</span>
                    </li>
                  ))}
                </ul>
                {order.deliveryAddress && <p className="customer-order-address"><MapPin size={14} /> {order.deliveryAddress}</p>}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
