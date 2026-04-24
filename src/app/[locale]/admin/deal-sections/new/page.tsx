import { DealSectionForm } from "@/components/admin/DealSectionForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tạo Deal Section — Admin" };

interface Props {
    params: Promise<{ locale: string }>;
}

export default async function NewDealSectionPage({ params }: Props) {
    const { locale } = await params;

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-extrabold text-[#1A1A2E]">⚡ Tạo Deal Section mới</h1>
                <p className="text-sm text-gray-400 mt-1">
                    Tạo section trước, sau đó thêm các sản phẩm deal vào trong trang quản lý section.
                </p>
            </div>
            <DealSectionForm locale={locale} />
        </div>
    );
}
