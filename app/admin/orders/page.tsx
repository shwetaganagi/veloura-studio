import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import AdminOrdersDashboard from "./OrdersDashboard";

async function AdminOrdersContent() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token || !(await verifyAdminSession(token))) {
    redirect("/admin/login");
  }

  return <AdminOrdersDashboard />;
}

export default function AdminOrdersPage() {
  return (
    <Suspense fallback={<p>Loading orders...</p>}>
      <AdminOrdersContent />
    </Suspense>
  );
}