"use server";

import "server-only";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { requireAdmin } from "@/lib/auth/session";
import { Timestamp } from "firebase-admin/firestore";
import type {
  PaymentMethodsSettingsDocument,
  PaymentMethodToggle,
  BankTransferSettingsDocument,
} from "@/types/firestore";

// ─── Default Payment Methods ──────────────────────────────────────────────────

const DEFAULT_METHODS: PaymentMethodToggle[] = [
  { id: "counter", enabled: true, order: 1 },
  { id: "bank_transfer", enabled: false, order: 2 },
  { id: "payos", enabled: false, order: 3 },
  { id: "vnpay_card", enabled: false, order: 4 },
  { id: "vnpay_intl", enabled: false, order: 5 },
  { id: "vnpay_transfer", enabled: false, order: 6 },
  { id: "vnpay_qr", enabled: false, order: 7 },
  { id: "vnpay_wallet", enabled: false, order: 8 },
  { id: "momo", enabled: false, order: 9 },
  { id: "zalopay", enabled: false, order: 10 },
  { id: "apple_pay", enabled: false, order: 11 },
];


// ─── Payment Methods Settings ─────────────────────────────────────────────────

export async function getPaymentMethodsSettings(): Promise<PaymentMethodToggle[]> {
  const doc = await adminDb
    .collection(COLLECTIONS.SETTINGS)
    .doc("paymentMethods")
    .get();

  if (!doc.exists) return DEFAULT_METHODS;

  const data = doc.data() as PaymentMethodsSettingsDocument;
  const saved = data.methods ?? [];

  // Merge: keep saved settings, append any new methods from defaults
  const savedIds = new Set(saved.map((m) => m.id));
  const merged = [
    ...saved,
    ...DEFAULT_METHODS.filter((d) => !savedIds.has(d.id)),
  ];

  return merged;
}

export async function updatePaymentMethodsSettings(
  methods: PaymentMethodToggle[]
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();

  if (!methods.length) {
    return { success: false, error: "Danh sách phương thức không được rỗng" };
  }

  await adminDb
    .collection(COLLECTIONS.SETTINGS)
    .doc("paymentMethods")
    .set(
      {
        methods,
        updatedAt: Timestamp.now(),
        updatedBy: session.uid,
      },
      { merge: true }
    );

  return { success: true };
}

// ─── Bank Transfer Settings ───────────────────────────────────────────────────

export interface BankTransferConfig {
  bankId: string;
  accountNo: string;
  template: string;
  accountName: string;
}

export async function getBankTransferSettings(): Promise<BankTransferConfig | null> {
  const doc = await adminDb
    .collection(COLLECTIONS.SETTINGS)
    .doc("bankTransfer")
    .get();

  if (!doc.exists) return null;

  const data = doc.data() as BankTransferSettingsDocument;
  return {
    bankId: data.bankId,
    accountNo: data.accountNo,
    template: data.template,
    accountName: data.accountName,
  };
}

export async function updateBankTransferSettings(
  config: BankTransferConfig
): Promise<{ success: boolean; error?: string }> {
  const session = await requireAdmin();

  // Validate all fields required
  if (!config.bankId?.trim()) {
    return { success: false, error: "Bank ID không được để trống" };
  }
  if (!config.accountNo?.trim()) {
    return { success: false, error: "Số tài khoản không được để trống" };
  }
  if (!config.template?.trim()) {
    return { success: false, error: "Template không được để trống" };
  }
  if (!config.accountName?.trim()) {
    return { success: false, error: "Tên chủ tài khoản không được để trống" };
  }

  await adminDb
    .collection(COLLECTIONS.SETTINGS)
    .doc("bankTransfer")
    .set(
      {
        bankId: config.bankId.trim(),
        accountNo: config.accountNo.trim(),
        template: config.template.trim(),
        accountName: config.accountName.trim().toUpperCase(),
        updatedAt: Timestamp.now(),
        updatedBy: session.uid,
      },
      { merge: true }
    );

  return { success: true };
}

// ─── Public: Get Enabled Payment Method IDs ───────────────────────────────────
/**
 * Public function (no admin check) — used by checkout page to determine
 * which payment methods to display.
 */
export async function getEnabledPaymentMethodIds(): Promise<string[]> {
  const methods = await getPaymentMethodsSettings();
  return methods.filter((m) => m.enabled).map((m) => m.id);
}
