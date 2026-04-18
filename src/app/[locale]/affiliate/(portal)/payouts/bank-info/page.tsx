import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyAffiliateProfile } from "@/actions/affiliate/apply";
import { BankInfoForm } from "./BankInfoForm";

export const metadata: Metadata = { title: "Thông tin ngân hàng" };

export default async function BankInfoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  let profile: Awaited<ReturnType<typeof getMyAffiliateProfile>>;

  try {
    profile = await getMyAffiliateProfile();
  } catch {
    redirect(`/${locale}/auth/login?next=/${locale}/affiliate/payouts/bank-info`);
  }

  if (!profile) redirect(`/${locale}/affiliate/apply`);

  return (
    <BankInfoForm
      currentBankInfo={profile!.bankInfo}
      isVerified={profile!.bankInfoVerified ?? false}
    />
  );
}
