"use client";

import { useState, useTransition } from "react";
import {
  createAdminUser,
  disableAdminUser,
  enableAdminUser,
  resetAdminPassword,
  type AdminUserRecord,
} from "@/actions/admin/accounts";
import {
  UserCog,
  Plus,
  Shield,
  ShieldOff,
  KeyRound,
  Loader2,
  X,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";

interface Props {
  initialAdmins: AdminUserRecord[];
}

// ─── Reusable Input ───────────────────────────────────────────────────────────
function Input({
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider block">
        {label}
      </label>
      <div className="relative">
        <input
          type={isPassword && show ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F5C842] focus:border-transparent bg-gray-50 pr-9"
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Row actions ──────────────────────────────────────────────────────────────
function StatusBadge({ disabled }: { disabled: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${
        disabled
          ? "bg-red-50 text-red-600"
          : "bg-emerald-50 text-emerald-700"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${disabled ? "bg-red-400" : "bg-emerald-500"}`} />
      {disabled ? "Vô hiệu" : "Hoạt động"}
    </span>
  );
}

export function AccountsClient({ initialAdmins }: Props) {
  const [admins, setAdmins] = useState<AdminUserRecord[]>(initialAdmins);
  const [isPending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // ── Create dialog state ──────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPass, setNewPass] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Reset password dialog state ──────────────────────────────────────────
  const [resetTarget, setResetTarget] = useState<AdminUserRecord | null>(null);
  const [resetPass, setResetPass] = useState("");
  const [resetError, setResetError] = useState<string | null>(null);

  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleCreate() {
    setCreateError(null);
    startTransition(async () => {
      const res = await createAdminUser({
        email: newEmail,
        password: newPass,
        displayName: newName,
      });
      if (res.success) {
        setShowCreate(false);
        setNewEmail(""); setNewName(""); setNewPass("");
        showToast("success", "Tạo tài khoản thành công");
        // Optimistic: add to list (will show after refresh)
        const fresh: AdminUserRecord = {
          uid: res.data!.uid,
          email: newEmail,
          displayName: newName,
          disabled: false,
          createdAt: new Date().toISOString(),
          lastSignIn: null,
        };
        setAdmins((prev) => [...prev, fresh]);
      } else {
        setCreateError(res.error);
      }
    });
  }

  function handleToggle(user: AdminUserRecord) {
    startTransition(async () => {
      const res = user.disabled
        ? await enableAdminUser(user.uid)
        : await disableAdminUser(user.uid);
      if (res.success) {
        setAdmins((prev) =>
          prev.map((u) => (u.uid === user.uid ? { ...u, disabled: !user.disabled } : u))
        );
        showToast("success", user.disabled ? "Đã kích hoạt lại" : "Đã vô hiệu hóa");
      } else {
        showToast("error", res.error);
      }
    });
  }

  function handleReset() {
    if (!resetTarget) return;
    setResetError(null);
    startTransition(async () => {
      const res = await resetAdminPassword(resetTarget.uid, resetPass);
      if (res.success) {
        setResetTarget(null);
        setResetPass("");
        showToast("success", "Đã đặt lại mật khẩu thành công");
      } else {
        setResetError(res.error);
      }
    });
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1A1A2E] flex items-center gap-2">
            <UserCog className="h-6 w-6 text-[#F5C842]" />
            Quản lý tài khoản Admin
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Tạo và quản lý tài khoản có quyền truy cập Admin Portal
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Thêm tài khoản
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-sm ${
            toast.type === "success"
              ? "bg-emerald-50 border border-emerald-200 text-emerald-700"
              : "bg-red-50 border border-red-200 text-red-600"
          }`}
        >
          {toast.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Admin list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {admins.length} tài khoản
          </p>
        </div>

        {admins.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <UserCog className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Chưa có tài khoản admin nào</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {admins.map((user) => (
              <div key={user.uid} className="flex items-center gap-4 px-5 py-4">
                {/* Avatar */}
                <div className="w-9 h-9 bg-[#1A1A2E] rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-bold text-xs">
                    {(user.displayName || user.email).charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1A1A2E] text-sm truncate">
                    {user.displayName || "(Chưa đặt tên)"}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Tạo lúc {new Date(user.createdAt).toLocaleDateString("vi-VN")}
                    {user.lastSignIn && (
                      <> · Đăng nhập gần nhất{" "}
                        {new Date(user.lastSignIn).toLocaleDateString("vi-VN")}
                      </>
                    )}
                  </p>
                </div>

                {/* Status badge */}
                <StatusBadge disabled={user.disabled} />

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => { setResetTarget(user); setResetPass(""); setResetError(null); }}
                    disabled={isPending}
                    title="Đặt lại mật khẩu"
                    className="p-2 text-gray-400 hover:text-[#1A1A2E] hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
                  >
                    <KeyRound className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleToggle(user)}
                    disabled={isPending}
                    title={user.disabled ? "Kích hoạt lại" : "Vô hiệu hóa"}
                    className={`p-2 rounded-lg transition-colors disabled:opacity-40 ${
                      user.disabled
                        ? "text-emerald-500 hover:bg-emerald-50"
                        : "text-red-400 hover:bg-red-50"
                    }`}
                  >
                    {user.disabled ? <Shield className="h-4 w-4" /> : <ShieldOff className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Create Admin Dialog ─────────────────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-[#1A1A2E] text-lg">Thêm tài khoản Admin</h2>
              <button onClick={() => setShowCreate(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            {createError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {createError}
              </div>
            )}

            <Input label="Họ và tên *" value={newName} onChange={setNewName} placeholder="Nguyễn Văn A" required />
            <Input label="Email *" type="email" value={newEmail} onChange={setNewEmail} placeholder="admin@bduck.vn" required />
            <Input label="Mật khẩu *" type="password" value={newPass} onChange={setNewPass} placeholder="Tối thiểu 8 ký tự" required />

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowCreate(false)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleCreate}
                disabled={isPending || !newEmail || !newName || !newPass}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#F5C842] text-[#1A1A2E] font-bold rounded-xl text-sm hover:bg-[#F5C842]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Tạo tài khoản
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Dialog ───────────────────────────────────────────── */}
      {resetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-[#1A1A2E] text-lg">Đặt lại mật khẩu</h2>
              <button onClick={() => setResetTarget(null)} className="p-1 text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Tài khoản: <strong className="text-[#1A1A2E]">{resetTarget.email}</strong>
            </p>

            {resetError && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-sm text-red-600">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {resetError}
              </div>
            )}

            <Input label="Mật khẩu mới *" type="password" value={resetPass} onChange={setResetPass} placeholder="Tối thiểu 8 ký tự" required />

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setResetTarget(null)}
                className="flex-1 py-3 border border-gray-200 text-gray-600 font-medium rounded-xl text-sm hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleReset}
                disabled={isPending || resetPass.length < 8}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-[#1A1A2E] text-white font-bold rounded-xl text-sm hover:bg-[#1A1A2E]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
