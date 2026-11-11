import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import InventoryClient from "./InventoryClient";

async function AdminInventoryContent() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token || !(await verifyAdminSession(token))) {
    redirect("/admin/login");
  }

  return <InventoryClient />;
}

export default function AdminInventoryPage() {
  return (
    <Suspense fallback={<main className="inventory-admin-page">Loading inventory…</main>}>
      <AdminInventoryContent />
    </Suspense>
  );
}
