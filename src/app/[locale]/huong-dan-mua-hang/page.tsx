import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/layout/PolicyPageLayout";

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "purchaseGuide" });
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
    };
}

export default async function PurchaseGuidePage({ params }: PageProps) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("purchaseGuide");

    const sections = [
        { id: "browse", icon: "🔍", title: t("sections.browse.title"), content: t("sections.browse.content") },
        { id: "cart", icon: "🛒", title: t("sections.cart.title"), content: t("sections.cart.content") },
        { id: "info", icon: "📝", title: t("sections.info.title"), content: t("sections.info.content") },
        { id: "payment", icon: "💳", title: t("sections.payment.title"), content: t("sections.payment.content") },
        { id: "receive", icon: "📧", title: t("sections.receive.title"), content: t("sections.receive.content") },
        { id: "use", icon: "📱", title: t("sections.use.title"), content: t("sections.use.content") },
        { id: "support", icon: "🎧", title: t("sections.support.title"), content: t("sections.support.content") },
    ];

    return (
        <PolicyPageLayout
            heroIcon="🎫"
            heroTitle={t("heroTitle")}
            heroSubtitle={t("heroSubtitle")}
            lastUpdated={t("lastUpdated")}
            intro={t("intro")}
            introVariant="amber"
            sections={sections}
            footerNote={t("footerNote")}
            accentColor="yellow"
        />
    );
}
