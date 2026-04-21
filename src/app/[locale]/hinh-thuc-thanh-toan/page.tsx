import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/layout/PolicyPageLayout";

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "paymentMethods" });
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
    };
}

export default async function PaymentMethodsPage({ params }: PageProps) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("paymentMethods");

    const sections = [
        { id: "online", icon: "💳", title: t("sections.online.title"), content: t("sections.online.content") },
        { id: "counter", icon: "🏪", title: t("sections.counter.title"), content: t("sections.counter.content") },
        { id: "promo", icon: "🎁", title: t("sections.promo.title"), content: t("sections.promo.content") },
        { id: "security", icon: "🔒", title: t("sections.security.title"), content: t("sections.security.content") },
        { id: "notes", icon: "⚠️", title: t("sections.notes.title"), content: t("sections.notes.content") },
    ];

    return (
        <PolicyPageLayout
            heroIcon="💳"
            heroTitle={t("heroTitle")}
            heroSubtitle={t("heroSubtitle")}
            lastUpdated={t("lastUpdated")}
            intro={t("intro")}
            introVariant="green"
            sections={sections}
            footerNote={t("footerNote")}
            accentColor="green"
        />
    );
}
