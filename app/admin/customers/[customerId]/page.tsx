import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import CustomerProfile from "./CustomerProfile";

async function AdminCustomerProfilePage({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminSession(token))) {
    redirect("/admin/login");
  }
  const { customerId } = await params;
  if (!/^[1-9]\d{0,18}$/.test(customerId)) notFound();
  return <CustomerProfile customerId={customerId} />;
}

export default function AdminCustomerProfileRoute({
  params,
}: {
  params: Promise<{ customerId: string }>;
}) {
  return (
    <Suspense fallback={<main className="customer-admin-page">Loading customer profile…</main>}>
      <AdminCustomerProfilePage params={params} />
    </Suspense>
  );
}
