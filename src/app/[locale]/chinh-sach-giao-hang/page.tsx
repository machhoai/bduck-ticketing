import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/layout/PolicyPageLayout";

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "deliveryPolicy" });
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
    };
}

export default async function DeliveryPolicyPage({ params }: PageProps) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("deliveryPolicy");

    const sections = [
        { id: "method", icon: "✉️", title: t("sections.method.title"), content: t("sections.method.content") },
        { id: "timeline", icon: "⚡", title: t("sections.timeline.title"), content: t("sections.timeline.content") },
        { id: "scope", icon: "🌐", title: t("sections.scope.title"), content: t("sections.scope.content") },
        { id: "notreceived", icon: "❓", title: t("sections.notreceived.title"), content: t("sections.notreceived.content") },
        { id: "notes", icon: "📌", title: t("sections.notes.title"), content: t("sections.notes.content") },
    ];

    return (
        <PolicyPageLayout
            heroIcon="🚀"
            heroTitle={t("heroTitle")}
            heroSubtitle={t("heroSubtitle")}
            lastUpdated={t("lastUpdated")}
            intro={t("intro")}
            introVariant="teal"
            sections={sections}
            footerNote={t("footerNote")}
            accentColor="teal"
        />
    );
}
