import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import CouponsDashboard from "./CouponsDashboard";

async function AdminCouponsContent() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminSession(token))) {
    redirect("/admin/login");
  }
  return <CouponsDashboard />;
}

export default function AdminCouponsPage() {
  return (
    <Suspense fallback={<main className="coupon-admin-page">Loading coupons…</main>}>
      <AdminCouponsContent />
    </Suspense>
  );
}
