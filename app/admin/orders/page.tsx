import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  SESSION_COOKIE_NAME,
  verifyAdminSession,
} from "@/lib/auth/admin";
import AdminOrdersDashboard from "./OrdersDashboard";


export default async function AdminOrdersPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token || !(await verifyAdminSession(token))) {
    redirect("/admin/login");
  }

  return <AdminOrdersDashboard />;
}