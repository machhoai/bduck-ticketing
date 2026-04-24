import { VoucherTemplateForm } from "@/components/admin/VoucherTemplateForm";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tạo mẫu Voucher — Admin" };

interface Props {
    params: Promise<{ locale: string }>;
}

export default async function NewVoucherTemplatePage({ params }: Props) {
    const { locale } = await params;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-extrabold text-[#1A1A2E]">✨ Tạo mẫu Voucher mới</h1>
                <p className="text-sm text-gray-400 mt-1">
                    Cấu hình tên, loại, code và thời hạn. Deal Section sẽ tham chiếu mẫu này khi tặng voucher.
                </p>
            </div>
            <VoucherTemplateForm locale={locale} />
        </div>
    );
}
