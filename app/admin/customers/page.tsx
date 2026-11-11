import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import CustomersDashboard from "./CustomersDashboard";

async function AdminCustomersContent() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminSession(token))) {
    redirect("/admin/login");
  }
  return <CustomersDashboard />;
}

export default function AdminCustomersPage() {
  return (
    <Suspense fallback={<main className="customer-admin-page">Loading customers…</main>}>
      <AdminCustomersContent />
    </Suspense>
  );
}
