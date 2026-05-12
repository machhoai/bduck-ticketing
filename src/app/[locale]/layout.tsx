import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/lib/auth/provider";
import { NavbarProvider } from "@/stores/navbar";
import { GoogleAnalytics, GoogleTagManager } from "@next/third-parties/google";
import "../globals.css";

const montserrat = Montserrat({
    variable: "--font-montserrat",
    subsets: ["latin", "vietnamese"],
    weight: ["300", "400", "500", "600", "700", "800", "900"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "B.Duck Cityfuns — Khoảnh khắc Vui vẻ, Trải nghiệm Quốc tế",
    description:
        "B.Duck Cityfuns — Khu vui chơi giải trí cao cấp dành cho trẻ em. Mua vé trực tuyến, các trò chơi hiện đại, an toàn tuyệt đối.",
    keywords: ["B.Duck", "Cityfuns", "khu vui chơi", "trẻ em", "amusement park", "Việt Nam"],
    openGraph: {
        title: "B.Duck Cityfuns — Khoảnh khắc Vui vẻ, Trải nghiệm Quốc tế",
        description:
            "B.Duck Cityfuns — Khu vui chơi giải trí cao cấp dành cho trẻ em. Mua vé trực tuyến, các trò chơi hiện đại, an toàn tuyệt đối.",
        url: process.env.NEXT_PUBLIC_APP_URL ?? "https://bduck-ticketing.vercel.app",
        siteName: "B.Duck Cityfuns",
        images: [
            {
                url: "/images/bduck_summer_backdrop.png",
                width: 1200,
                height: 630,
                alt: "B.Duck Cityfuns — Summer Fun",
            },
        ],
        locale: "vi_VN",
        type: "website",
    },
    twitter: {
        card: "summary_large_image",
        title: "B.Duck Cityfuns — Khoảnh khắc Vui vẻ, Trải nghiệm Quốc tế",
        description:
            "B.Duck Cityfuns — Khu vui chơi giải trí cao cấp dành cho trẻ em. Mua vé trực tuyến, các trò chơi hiện đại, an toàn tuyệt đối.",
        images: ["/images/bduck_summer_backdrop.png"],
    },
};

export function generateStaticParams() {
    return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
    children,
    params,
}: {
    children: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;

    // Validate locale
    if (!hasLocale(routing.locales, locale)) {
        notFound();
    }

    setRequestLocale(locale);

    // Fetch all messages for client components
    const messages = await getMessages();

    return (
        <html
            lang={locale}
            className={`${montserrat.variable} antialiased`}
        >
            <body className="min-h-screen flex flex-col bg-white text-text-primary">
                <NextIntlClientProvider locale={locale} messages={messages}>
                    <AuthProvider>
                        <NavbarProvider>
                            <Navbar />
                            <main className="flex-1">{children}</main>
                            <Footer />
                        </NavbarProvider>
                    </AuthProvider>
                </NextIntlClientProvider>
                <GoogleAnalytics gaId="G-1NPZNCKHD6" />
                <GoogleTagManager gtmId="GTM-PJLFRG6W" />
            </body>
        </html>
    );
}
