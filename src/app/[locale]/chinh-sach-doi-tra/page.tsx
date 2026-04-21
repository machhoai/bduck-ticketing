import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";
import { PolicyPageLayout } from "@/components/layout/PolicyPageLayout";

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "returnPolicy" });
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
    };
}

export default async function ReturnPolicyPage({ params }: PageProps) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("returnPolicy");

    const sections = [
        { id: "conditions", icon: "✅", title: t("sections.conditions.title"), content: t("sections.conditions.content") },
        { id: "process", icon: "📋", title: t("sections.process.title"), content: t("sections.process.content") },
        { id: "timeline", icon: "⏱️", title: t("sections.timeline.title"), content: t("sections.timeline.content") },
        { id: "exceptions", icon: "🚫", title: t("sections.exceptions.title"), content: t("sections.exceptions.content") },
        { id: "contact", icon: "📞", title: t("sections.contact.title"), content: t("sections.contact.content") },
    ];

    return (
        <PolicyPageLayout
            heroIcon="↩️"
            heroTitle={t("heroTitle")}
            heroSubtitle={t("heroSubtitle")}
            lastUpdated={t("lastUpdated")}
            intro={t("intro")}
            introVariant="orange"
            sections={sections}
            footerNote={t("footerNote")}
            accentColor="orange"
        />
    );
}
