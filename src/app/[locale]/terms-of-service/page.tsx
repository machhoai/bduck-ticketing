import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "termsOfService" });
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
    };
}

export default async function TermsOfServicePage({ params }: PageProps) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("termsOfService");

    const sections = [
        {
            id: "acceptance",
            icon: "✅",
            title: t("sections.acceptance.title"),
            content: t("sections.acceptance.content"),
        },
        {
            id: "tickets",
            icon: "🎫",
            title: t("sections.tickets.title"),
            content: t("sections.tickets.content"),
        },
        {
            id: "payment",
            icon: "💳",
            title: t("sections.payment.title"),
            content: t("sections.payment.content"),
        },
        {
            id: "refund",
            icon: "↩️",
            title: t("sections.refund.title"),
            content: t("sections.refund.content"),
        },
        {
            id: "conduct",
            icon: "🧑‍🤝‍🧑",
            title: t("sections.conduct.title"),
            content: t("sections.conduct.content"),
        },
        {
            id: "liability",
            icon: "⚠️",
            title: t("sections.liability.title"),
            content: t("sections.liability.content"),
        },
        {
            id: "changes",
            icon: "📝",
            title: t("sections.changes.title"),
            content: t("sections.changes.content"),
        },
        {
            id: "governing",
            icon: "🏛️",
            title: t("sections.governing.title"),
            content: t("sections.governing.content"),
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FFFDF5] to-white">
            {/* ── Hero Banner ── */}
            <div className="relative overflow-hidden bg-[#1A1A2E] text-white py-20 px-6">
                <div
                    className="absolute top-0 left-0 w-[600px] h-[600px] rounded-full pointer-events-none"
                    style={{
                        background: "radial-gradient(circle, rgba(255,209,0,0.12) 0%, transparent 65%)",
                        transform: "translate(-30%, -40%)",
                    }}
                />
                <div
                    className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full pointer-events-none"
                    style={{
                        background: "radial-gradient(circle, rgba(255,121,0,0.10) 0%, transparent 65%)",
                        transform: "translate(30%, 40%)",
                    }}
                />
                <div className="relative max-w-4xl mx-auto text-center">
                    <span className="inline-block text-4xl mb-4">📄</span>
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
                        {t("heroTitle")}
                    </h1>
                    <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                        {t("heroSubtitle")}
                    </p>
                    <p className="mt-6 text-xs text-white/40">
                        {t("lastUpdated")}
                    </p>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="max-w-4xl mx-auto px-6 py-16">
                {/* Intro Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mb-12">
                    <p className="text-blue-900 text-sm leading-relaxed">
                        {t("intro")}
                    </p>
                </div>

                {/* Sections */}
                <div className="space-y-10">
                    {sections.map((section, index) => (
                        <section
                            key={section.id}
                            id={section.id}
                            aria-labelledby={`heading-${section.id}`}
                            className="group"
                        >
                            <div className="flex items-start gap-4">
                                {/* Number */}
                                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                                    <div className="w-10 h-10 rounded-2xl bg-[#1A1A2E] flex items-center justify-center text-white font-black text-sm shadow-md">
                                        {index + 1}
                                    </div>
                                    {index < sections.length - 1 && (
                                        <div className="w-px h-8 bg-gradient-to-b from-[#1A1A2E]/20 to-transparent mt-1" />
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 pb-2">
                                    <div className="flex items-center gap-2.5 mb-3">
                                        <span className="text-xl">{section.icon}</span>
                                        <h2
                                            id={`heading-${section.id}`}
                                            className="text-xl font-bold text-[#1A1A2E]"
                                        >
                                            {section.title}
                                        </h2>
                                    </div>
                                    <p className="text-gray-600 leading-relaxed text-[15px] whitespace-pre-line">
                                        {section.content}
                                    </p>
                                </div>
                            </div>
                        </section>
                    ))}
                </div>

                {/* Footer note */}
                <div className="mt-16 pt-8 border-t border-gray-100 text-center">
                    <p className="text-xs text-gray-400">{t("footerNote")}</p>
                </div>
            </div>
        </div>
    );
}
