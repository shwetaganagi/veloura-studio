
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Customer = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  emailVerified: boolean;
};

type OrderItem = {
  productName: string;
  quantity: number;
  unitPrice: number;
};

type Order = {
  id: string;
  customerName: string;
  total: number;
  status: string;
  createdAt: string;
  items: OrderItem[];
};

export default function AccountPage() {
  const router = useRouter();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [ordersError, setOrdersError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
    const [profileName, setProfileName] = useState("");
    const [profilePhone, setProfilePhone] = useState("");
    const [savingProfile, setSavingProfile] = useState(false);
    const [profileMessage, setProfileMessage] = useState("");
    const [profileError, setProfileError] = useState("");

  useEffect(() => {
    async function loadAccount() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        const data = await response.json();

        if (!response.ok || !data.success) {
          throw new Error("Unable to load your account.");
        }

        setCustomer(data.customer);
        setProfileName(data.customer.fullName);
        setProfilePhone(data.customer.phone ?? "");

        const ordersResponse = await fetch("/api/account/orders", {
          cache: "no-store",
        });

        const ordersData = await ordersResponse.json();

        if (!ordersResponse.ok || !ordersData.success) {
          throw new Error(
            ordersData.message || "Unable to load your orders."
          );
        }

        setOrders(ordersData.orders);
      } catch (err) {
        if (customer === null) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your account."
          );
        } else {
          setOrdersError("Unable to load your orders. Please refresh.");
        }
      } finally {
        setLoading(false);
        setOrdersLoading(false);
      }
    }

    loadAccount();
  }, [router]);

  useEffect(() => {
    if (loading) return;

    const sectionId = window.location.hash.slice(1);
    if (sectionId !== "profile" && sectionId !== "orders") return;

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [loading]);

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      router.replace("/login");
      router.refresh();
    } catch {
      setError("Unable to log out. Please try again.");
      setLoggingOut(false);
    }
  }
  
  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  setSavingProfile(true);
  setProfileMessage("");
  setProfileError("");

  try {
    const response = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fullName: profileName,
        phone: profilePhone,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.message || "Unable to update your profile.");
    }

    setCustomer(data.customer);
    setProfileName(data.customer.fullName);
    setProfilePhone(data.customer.phone ?? "");
    setIsEditing(false);
    setProfileMessage("Your profile has been updated successfully.");
  } catch (err) {
    setProfileError(
      err instanceof Error ? err.message : "Unable to update your profile."
    );
  } finally {
    setSavingProfile(false);
  }
}

  function formatPrice(amount: number) {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(amount);
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  function statusLabel(status: string) {
    return status.charAt(0).toUpperCase() + status.slice(1);
  }


function renderOrderTracking(status: string) {
  const stages = [
    { value: "pending", label: "Order Placed" },
    { value: "confirmed", label: "Confirmed" },
    { value: "preparing", label: "Preparing" },
    { value: "shipped", label: "Shipped" },
    { value: "delivered", label: "Delivered" },
  ];

  if (status === "cancelled") {
    return (
      <div className="tracking-cancelled">
        <strong>Order Cancelled</strong>
        <p>This order has been cancelled.</p>
      </div>
    );
  }

  const currentIndex = stages.findIndex(
    (stage) => stage.value === status
  );

  return (
    <div className="order-tracking">
      <h3>Track Your Order</h3>

      <ol className="tracking-timeline">
        {stages.map((stage, index) => {
          const completed = index < currentIndex;
          const current = index === currentIndex;

          return (
            <li
              key={stage.value}
              className={[
                completed ? "is-complete" : "",
                current ? "is-current" : "",
                index > currentIndex ? "is-upcoming" : "",
              ].join(" ")}
            >
              <span className="tracking-dot">
                {completed ? "✓" : index + 1}
              </span>

              <div className="tracking-stage">
                <strong>{stage.label}</strong>
                {current && <span>Current Status</span>}
                {completed && <span>Completed</span>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

  if (loading) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <p>Loading your account...</p>
        </div>
      </main>
    );
  }

  if (error && !customer) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <p className="auth-message">{error}</p>
          <button
            className="auth-submit account-logout"
            onClick={() => window.location.reload()}
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  if (!customer) return null;

  return (
    <main className="auth-page">
      <section className="auth-card register-card">
        <div className="auth-brand">
          <h1>Veloura Studio</h1>
          <p>MY ACCOUNT</p>
        </div>

        <h2>Welcome, {customer.fullName}!</h2>

        <p className="auth-description">
          Manage your account and keep track of your orders.
        </p>

        <div className="account-details" id="profile">
  <div>
    <span>Full Name</span>
    <strong>{customer.fullName}</strong>
  </div>

  <div>
    <span>Email Address</span>
    <strong>{customer.email}</strong>
  </div>

  <div>
    <span>Mobile Number</span>
    <strong>{customer.phone || "Not added"}</strong>
  </div>

  <div>
    <span>Email Verification</span>
    <strong>
      {customer.emailVerified ? "Verified" : "Not verified"}
    </strong>
  </div>
</div>

{!isEditing ? (
  <button
    type="button"
    className="account-home-link"
    onClick={() => {
      setProfileName(customer.fullName);
      setProfilePhone(customer.phone || "");
      setProfileMessage("");
      setProfileError("");
      setIsEditing(true);
    }}
  >
    Edit Profile
  </button>
) : (
  <form className="auth-form" onSubmit={handleSaveProfile}>
    <h2>Edit Your Profile</h2>

    <label htmlFor="profileName">Full Name</label>
    <input
      id="profileName"
      type="text"
      value={profileName}
      onChange={(e) => setProfileName(e.target.value)}
      minLength={2}
      maxLength={150}
      required
    />

    <label htmlFor="profilePhone">Mobile Number</label>
    <input
      id="profilePhone"
      type="tel"
      value={profilePhone}
      onChange={(e) => setProfilePhone(e.target.value)}
      placeholder="10-digit mobile number"
      maxLength={10}
    />

    <p className="auth-description">
      Your email address cannot be changed here.
    </p>

    {profileError && (
      <p className="auth-message">{profileError}</p>
    )}

    <button
      type="submit"
      className="auth-submit"
      disabled={savingProfile}
    >
      {savingProfile ? "Saving..." : "Save Changes"}
    </button>

    <button
      type="button"
      className="account-home-link"
      disabled={savingProfile}
      onClick={() => {
        setIsEditing(false);
        setProfileError("");
        setProfileName(customer.fullName);
        setProfilePhone(customer.phone || "");
      }}
    >
      Cancel
    </button>
  </form>
)}

{profileMessage && (
  <p role="status" className="auth-success">
    {profileMessage}
  </p>
)}

        <div className="account-orders" id="orders">
          <h2>My Orders</h2>
          <p className="auth-description">
            Your recent purchases and order updates.
          </p>

          {ordersLoading ? (
            <p>Loading your orders...</p>
          ) : ordersError ? (
            <p className="auth-message">{ordersError}</p>
          ) : orders.length === 0 ? (
            <div className="empty-orders">
              <p>You haven&apos;t placed any orders yet.</p>
              <button
                className="account-home-link"
                onClick={() => router.push("/")}
              >
                Explore Our Collection
              </button>
            </div>
          ) : (
            <div className="orders-list">
              {orders.map((order) => (
                <article className="order-card" key={order.id}>
                  <div className="order-header">
                    <div>
                      <span>Order ID</span>
                      <strong>#{order.id}</strong>
                    </div>

                    <span className="order-status">
                      {statusLabel(order.status)}
                    </span>
                  </div>

                  <p className="order-date">
                    Ordered on {formatDate(order.createdAt)}
                  </p>
                  {renderOrderTracking(order.status)}

                  <div className="order-items">
                    {order.items.map((item, index) => (
                      <div
                        className="order-item"
                        key={`${order.id}-${index}`}
                      >
                        <span>
                          {item.productName} × {item.quantity}
                        </span>
                        <strong>
                          {formatPrice(item.unitPrice * item.quantity)}
                        </strong>
                      </div>
                    ))}
                  </div>

                  <div className="order-total">
                    <span>Total</span>
                    <strong>{formatPrice(order.total)}</strong>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {error && <p className="auth-message">{error}</p>}

        <button
          className="auth-submit account-logout"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "Logging out..." : "Log Out"}
        </button>

        <button
          className="account-home-link"
          onClick={() => router.push("/")}
        >
          Continue Shopping
        </button>
      </section>
    </main>
  );
}
