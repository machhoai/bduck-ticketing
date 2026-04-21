interface PolicySection {
    id: string;
    icon: string;
    title: string;
    content: string;
}

type AccentColor = "yellow" | "blue" | "green" | "orange" | "purple" | "teal";

interface PolicyPageLayoutProps {
    heroIcon: string;
    heroTitle: string;
    heroSubtitle: string;
    lastUpdated: string;
    intro: string;
    introVariant?: "amber" | "blue" | "green" | "orange" | "purple" | "teal";
    sections: PolicySection[];
    footerNote: string;
    accentColor?: AccentColor;
}

const accentStyles: Record<AccentColor, { badge: string; connector: string }> = {
    yellow: {
        badge: "bg-gradient-to-br from-[#FFD100] to-[#FF7900]",
        connector: "from-[#FFD100]/40",
    },
    blue: {
        badge: "bg-gradient-to-br from-blue-500 to-blue-700",
        connector: "from-blue-400/40",
    },
    green: {
        badge: "bg-gradient-to-br from-emerald-400 to-emerald-600",
        connector: "from-emerald-400/40",
    },
    orange: {
        badge: "bg-gradient-to-br from-orange-400 to-red-500",
        connector: "from-orange-400/40",
    },
    purple: {
        badge: "bg-gradient-to-br from-purple-500 to-violet-700",
        connector: "from-purple-400/40",
    },
    teal: {
        badge: "bg-gradient-to-br from-teal-400 to-cyan-600",
        connector: "from-teal-400/40",
    },
};

const introStyles: Record<string, string> = {
    amber: "bg-amber-50 border-amber-200 text-amber-900",
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    green: "bg-emerald-50 border-emerald-200 text-emerald-900",
    orange: "bg-orange-50 border-orange-200 text-orange-900",
    purple: "bg-purple-50 border-purple-200 text-purple-900",
    teal: "bg-teal-50 border-teal-200 text-teal-900",
};

export function PolicyPageLayout({
    heroIcon,
    heroTitle,
    heroSubtitle,
    lastUpdated,
    intro,
    introVariant = "amber",
    sections,
    footerNote,
    accentColor = "yellow",
}: PolicyPageLayoutProps) {
    const accent = accentStyles[accentColor];
    const introStyle = introStyles[introVariant];

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
                    <span className="inline-block text-4xl mb-4">{heroIcon}</span>
                    <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight mb-4">
                        {heroTitle}
                    </h1>
                    <p className="text-white/60 text-base md:text-lg max-w-xl mx-auto leading-relaxed">
                        {heroSubtitle}
                    </p>
                    <p className="mt-6 text-xs text-white/40">{lastUpdated}</p>
                </div>
            </div>

            {/* ── Content ── */}
            <div className="max-w-4xl mx-auto px-6 py-16">
                {/* Intro Card */}
                <div className={`border rounded-2xl p-6 mb-12 ${introStyle}`}>
                    <p className="text-sm leading-relaxed">{intro}</p>
                </div>

                {/* Sections */}
                <div className="space-y-10">
                    {sections.map((section, index) => (
                        <section
                            key={section.id}
                            id={section.id}
                            aria-labelledby={`heading-${section.id}`}
                        >
                            <div className="flex items-start gap-4">
                                {/* Number badge */}
                                <div className="flex-shrink-0 flex flex-col items-center gap-1">
                                    <div
                                        className={`w-10 h-10 rounded-2xl flex items-center justify-center text-white font-black text-sm shadow-md ${accent.badge}`}
                                    >
                                        {index + 1}
                                    </div>
                                    {index < sections.length - 1 && (
                                        <div
                                            className={`w-px h-8 bg-gradient-to-b ${accent.connector} to-transparent mt-1`}
                                        />
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
                    <p className="text-xs text-gray-400">{footerNote}</p>
                </div>
            </div>
        </div>
    );
}
