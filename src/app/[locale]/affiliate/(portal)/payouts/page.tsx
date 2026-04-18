import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getMyAffiliateProfile } from "@/actions/affiliate/apply";
import { getPayoutHistory } from "@/actions/affiliate/payouts";
import { PayoutsView } from "./PayoutsView";

export const metadata: Metadata = { title: "Rút tiền" };

export default async function PayoutsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  let profile: Awaited<ReturnType<typeof getMyAffiliateProfile>>;
  let history: Awaited<ReturnType<typeof getPayoutHistory>>;

  try {
    [profile, history] = await Promise.all([getMyAffiliateProfile(), getPayoutHistory()]);
  } catch {
    redirect(`/${locale}/auth/login?next=/${locale}/affiliate/payouts`);
  }

  if (!profile) {
    redirect(`/${locale}/affiliate/apply`);
  }

  return <PayoutsView walletBalance={profile!.walletBalance ?? 0} history={history!} />;
}
