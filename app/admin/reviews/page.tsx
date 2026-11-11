import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import AdminReviewsDashboard from "./ReviewsDashboard";

async function AdminReviewsContent() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token || !(await verifyAdminSession(token))) {
    redirect("/admin/login");
  }

  return <AdminReviewsDashboard />;
}

export default function AdminReviewsPage() {
  return (
    <Suspense fallback={<p>Loading reviews...</p>}>
      <AdminReviewsContent />
    </Suspense>
  );
}
