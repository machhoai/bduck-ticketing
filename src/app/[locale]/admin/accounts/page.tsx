import { listAdminUsers } from "@/actions/admin/accounts";
import { AccountsClient } from "./AccountsClient";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Quản lý tài khoản" };

export default async function AccountsPage() {
  const admins = await listAdminUsers();
  return <AccountsClient initialAdmins={admins} />;
}
