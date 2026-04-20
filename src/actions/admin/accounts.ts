"use server";

import "server-only";
import { adminAuth } from "@/lib/firebase/admin";
import { requireAdmin } from "@/lib/auth/session";

export type AdminUserRecord = {
  uid: string;
  email: string;
  displayName: string;
  disabled: boolean;
  createdAt: string; // ISO string
  lastSignIn: string | null;
};

export type AccountActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string };

// ─── List Admin Users ─────────────────────────────────────────────────────────
/**
 * Lists all Firebase Auth users that have role:"admin" custom claim.
 * Firebase listUsers() is paginated (max 1000/page); for small admin teams
 * iterating once is sufficient.
 */
export async function listAdminUsers(): Promise<AdminUserRecord[]> {
  await requireAdmin();

  const result = await adminAuth.listUsers(1000);

  return result.users
    .filter((u) => {
      const claims = u.customClaims as { role?: string } | undefined;
      return claims?.role === "admin";
    })
    .map((u) => ({
      uid: u.uid,
      email: u.email ?? "(no email)",
      displayName: u.displayName ?? "",
      disabled: u.disabled,
      createdAt: u.metadata.creationTime ?? new Date().toISOString(),
      lastSignIn: u.metadata.lastSignInTime ?? null,
    }))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

// ─── Create Admin User ────────────────────────────────────────────────────────
export async function createAdminUser(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AccountActionResult<{ uid: string }>> {
  await requireAdmin();

  const { email, password, displayName } = input;

  if (!email || !password || !displayName) {
    return { success: false, error: "Vui lòng điền đầy đủ thông tin" };
  }
  if (password.length < 8) {
    return { success: false, error: "Mật khẩu tối thiểu 8 ký tự" };
  }

  try {
    const user = await adminAuth.createUser({ email, password, displayName });
    await adminAuth.setCustomUserClaims(user.uid, { role: "admin" });

    return { success: true, data: { uid: user.uid } };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const errorMap: Record<string, string> = {
      "auth/email-already-exists": "Email này đã được sử dụng",
      "auth/invalid-email": "Email không hợp lệ",
      "auth/weak-password": "Mật khẩu quá yếu",
    };
    return { success: false, error: errorMap[code ?? ""] ?? "Tạo tài khoản thất bại" };
  }
}

// ─── Disable Admin User ───────────────────────────────────────────────────────
export async function disableAdminUser(
  targetUid: string
): Promise<AccountActionResult> {
  const session = await requireAdmin();

  if (session.uid === targetUid) {
    return { success: false, error: "Không thể tự vô hiệu hóa tài khoản của mình" };
  }

  try {
    await adminAuth.updateUser(targetUid, { disabled: true });
    return { success: true };
  } catch {
    return { success: false, error: "Không thể vô hiệu hóa tài khoản" };
  }
}

// ─── Enable Admin User ────────────────────────────────────────────────────────
export async function enableAdminUser(
  targetUid: string
): Promise<AccountActionResult> {
  await requireAdmin();

  try {
    await adminAuth.updateUser(targetUid, { disabled: false });
    return { success: true };
  } catch {
    return { success: false, error: "Không thể kích hoạt lại tài khoản" };
  }
}

// ─── Reset Admin Password ─────────────────────────────────────────────────────
export async function resetAdminPassword(
  targetUid: string,
  newPassword: string
): Promise<AccountActionResult> {
  await requireAdmin();

  if (newPassword.length < 8) {
    return { success: false, error: "Mật khẩu tối thiểu 8 ký tự" };
  }

  try {
    await adminAuth.updateUser(targetUid, { password: newPassword });
    return { success: true };
  } catch {
    return { success: false, error: "Không thể đặt lại mật khẩu" };
  }
}
