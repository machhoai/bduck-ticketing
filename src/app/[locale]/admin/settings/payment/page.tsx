import type { Metadata } from "next";
import {
  getPaymentMethodsSettings,
  getBankTransferSettings,
  getPaymentMethodsOverrideInfo,
} from "@/actions/admin/settings";
import { PaymentSettingsClient } from "./PaymentSettingsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cấu hình thanh toán — Admin",
};

export default async function PaymentSettingsPage() {
  const methods = await getPaymentMethodsSettings();
  const bankConfig = await getBankTransferSettings();
  const paymentOverride = await getPaymentMethodsOverrideInfo();

  return (
    <PaymentSettingsClient
      initialMethods={methods}
      initialBankConfig={bankConfig}
      paymentOverride={paymentOverride}
    />
  );
}
