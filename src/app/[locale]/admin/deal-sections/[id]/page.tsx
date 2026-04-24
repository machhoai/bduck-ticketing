import { getAdminDealSection } from "@/actions/admin/dealSections";
import { getAdminVoucherTemplates } from "@/actions/admin/voucherTemplates";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { DealSectionForm } from "@/components/admin/DealSectionForm";
import { DealItemsPanel } from "@/components/admin/DealItemsPanel";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import type { ProductDocument } from "@/types/firestore";

export const metadata: Metadata = { title: "Quản lý Deal Section — Admin" };
export const dynamic = "force-dynamic";

interface Props {
    params: Promise<{ locale: string; id: string }>;
}

export default async function EditDealSectionPage({ params }: Props) {
    const { locale, id } = await params;

    const [section, voucherTemplates, productsSnap] = await Promise.all([
        getAdminDealSection(id),
        getAdminVoucherTemplates(),
        adminDb
            .collection(COLLECTIONS.PRODUCTS)
            .where("status", "==", "active")
            .orderBy("name", "asc")
            .get(),
    ]);

    if (!section) notFound();

    const linkedProducts = productsSnap.docs.map((d) => {
        const p = { id: d.id, ...d.data() } as ProductDocument;
        return { id: p.id, name: p.name, price: p.price, type: p.type, thumbnailUrl: p.thumbnailUrl };
    });

    const activeVoucherTemplates = voucherTemplates
        .filter((t) => t.isActive)
        .map((t) => ({ id: t.id, name: t.name }));

    return (
        <div className="space-y-8 max-w-4xl">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-extrabold text-[#1A1A2E]">⚡ {section.title}</h1>
                <p className="text-sm text-gray-400 mt-1">
                    {section.items.length} deal items · Chỉnh sửa section và quản lý sản phẩm deal
                </p>
            </div>

            {/* Section metadata form */}
            <div className="space-y-2">
                <h2 className="text-lg font-bold text-[#1A1A2E]">📋 Cấu hình section</h2>
                <DealSectionForm section={section} locale={locale} compact />
            </div>

            {/* Deal items */}
            <div className="space-y-3">
                <h2 className="text-lg font-bold text-[#1A1A2E]">🛍️ Sản phẩm deal ({section.items.length})</h2>
                <DealItemsPanel
                    section={section}
                    voucherTemplates={activeVoucherTemplates}
                    linkedProducts={linkedProducts}
                />
            </div>
        </div>
    );
}
