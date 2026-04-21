import { getTranslations, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "privacyPolicy" });
    return {
        title: t("metaTitle"),
        description: t("metaDescription"),
    };
}

export default async function PrivacyPolicyPage({ params }: PageProps) {
    const { locale } = await params;
    setRequestLocale(locale);
    const t = await getTranslations("privacyPolicy");

    const sections = [
        {
            id: "collection",
            icon: "🗂️",
            title: t("sections.collection.title"),
            content: t("sections.collection.content"),
        },
        {
            id: "usage",
            icon: "⚙️",
            title: t("sections.usage.title"),
            content: t("sections.usage.content"),
        },
        {
            id: "sharing",
            icon: "🔗",
            title: t("sections.sharing.title"),
            content: t("sections.sharing.content"),
        },
        {
            id: "security",
            icon: "🔒",
            title: t("sections.security.title"),
            content: t("sections.security.content"),
        },
        {
            id: "cookies",
            icon: "🍪",
            title: t("sections.cookies.title"),
            content: t("sections.cookies.content"),
        },
        {
            id: "rights",
            icon: "⚖️",
            title: t("sections.rights.title"),
            content: t("sections.rights.content"),
        },
        {
            id: "contact",
            icon: "📬",
            title: t("sections.contact.title"),
            content: t("sections.contact.content"),
        },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-b from-[#FFFDF5] to-white">
            {/* ── Hero Banner ── */}
            <div className="relative overflow-hidden bg-[#1A1A2E] text-white py-20 px-6">
                {/* Decorative blobs */}
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
                    <span className="inline-block text-4xl mb-4">🔒</span>
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
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-12">
                    <p className="text-amber-900 text-sm leading-relaxed">
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
                                {/* Number + Icon */}
                                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#FFD100] to-[#FF7900] flex items-center justify-center text-white font-black text-sm shadow-md">
                                        {index + 1}
                                    </div>
                                    {index < sections.length - 1 && (
                                        <div className="w-px h-8 bg-gradient-to-b from-[#FFD100]/40 to-transparent mt-1" />
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
