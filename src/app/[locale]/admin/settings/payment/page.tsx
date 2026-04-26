import type { Metadata } from "next";
import {
  getPaymentMethodsSettings,
  getBankTransferSettings,
} from "@/actions/admin/settings";
import { PaymentSettingsClient } from "./PaymentSettingsClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cấu hình thanh toán — Admin",
};

export default async function PaymentSettingsPage() {
  const methods = await getPaymentMethodsSettings();
  const bankConfig = await getBankTransferSettings();

  return (
    <PaymentSettingsClient
      initialMethods={methods}
      initialBankConfig={bankConfig}
    />
  );
}
