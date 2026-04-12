import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Poppins } from "next/font/google";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/lib/auth/provider";
import "../globals.css";

const plusJakarta = Plus_Jakarta_Sans({
    variable: "--font-plus-jakarta",
    subsets: ["latin", "vietnamese"],
    weight: ["400", "500", "600", "700", "800"],
    display: "swap",
});

const poppins = Poppins({
    variable: "--font-poppins",
    subsets: ["latin", "latin-ext"],
    weight: ["300", "400", "500", "600", "700"],
    display: "swap",
});

export const metadata: Metadata = {
    title: "B.Duck Cityfuns — Khoảnh khắc Vui vẻ, Trải nghiệm Quốc tế",
    description:
        "B.Duck Cityfuns — Khu vui chơi giải trí cao cấp dành cho trẻ em. Mua vé trực tuyến, các trò chơi hiện đại, an toàn tuyệt đối.",
    keywords: ["B.Duck", "Cityfuns", "khu vui chơi", "trẻ em", "amusement park", "Việt Nam"],
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
            className={`${plusJakarta.variable} ${poppins.variable} antialiased`}
        >
            <body className="min-h-screen flex flex-col bg-white text-text-primary">
                <NextIntlClientProvider locale={locale} messages={messages}>
                    <AuthProvider>
                        <Navbar />
                        <main className="flex-1">{children}</main>
                        <Footer />
                    </AuthProvider>
                </NextIntlClientProvider>
            </body>
        </html>
    );
}
