import { Hero } from "@/components/home/Hero";
import { Attractions } from "@/components/home/Attractions";
import { setRequestLocale } from "next-intl/server";

interface PageProps {
    params: Promise<{ locale: string }>;
}

export default async function HomePage({ params }: PageProps) {
    const { locale } = await params;
    setRequestLocale(locale);

    return (
        <>
            <Hero />
            <Attractions />
        </>
    );
}
