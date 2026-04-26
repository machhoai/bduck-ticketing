// E-ticket wallet page — shows ALL passes from the same order
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { PassCard, type SerializedPass } from "@/components/customer/PassCard";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, Smartphone, Eye, Ticket, Gift } from "lucide-react";
import { VoucherQRCard } from "@/components/customer/VoucherQRCard";

export const dynamic = "force-dynamic"; // always fresh — no cache for tickets

interface PageProps {
    params: Promise<{ locale: string; passId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { passId } = await params;
    return {
        title: `E-Ticket #${passId.slice(-8).toUpperCase()} — B.Duck Cityfuns`,
        robots: "noindex",
    };
}

// Serialize Firestore Timestamps → ISO strings for client component
const toISO = (ts: { toDate?: () => Date } | undefined) =>
    ts?.toDate ? ts.toDate().toISOString() : undefined;

function serializePass(doc: FirebaseFirestore.DocumentSnapshot): SerializedPass {
    const raw = doc.data()!;
    return {
        id: doc.id,
        orderId: raw.orderId,
        orderNumber: raw.orderNumber,
        customerId: raw.customerId,
        customerName: raw.customerName,
        customerEmail: raw.customerEmail,
        productId: raw.productId,
        productName: raw.productName,
        productType: raw.productType,
        thumbnailUrl: raw.thumbnailUrl,
        validityType: raw.validityType,
        status: raw.status,
        comboItems: raw.comboItems ?? null,
        walletPassUrl: raw.walletPassUrl ?? null,
        affiliateId: raw.affiliateId ?? null,
        visitDate: toISO(raw.visitDate),
        validFrom: toISO(raw.validFrom),
        validUntil: toISO(raw.validUntil),
        createdAt: toISO(raw.createdAt),
        usedAt: toISO(raw.usedAt),
    };
}

export default async function ETicketPage({ params }: PageProps) {
    const { locale, passId } = await params;
    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: "ticketWallet" });

    // 1. Load the requested pass
    const doc = await adminDb.collection(COLLECTIONS.PASSES).doc(passId).get();
    if (!doc.exists) notFound();

    const primaryPass = serializePass(doc);

    // 2. Load ALL sibling passes from the same order
    let allPasses: SerializedPass[] = [primaryPass];

    if (primaryPass.orderId) {
        const siblingSnap = await adminDb
            .collection(COLLECTIONS.PASSES)
            .where("orderId", "==", primaryPass.orderId)
            .orderBy("createdAt", "asc")
            .get();

        if (!siblingSnap.empty) {
            allPasses = siblingSnap.docs.map(serializePass);
        }
    }

    // Find index of the primary pass for highlighting
    const primaryIndex = allPasses.findIndex((p) => p.id === passId);

    // 3. Load vouchers for this order
    interface VoucherDisplay {
        id: string;
        code: string;
        templateName: string;
        status: string;
        voucherType: string;
    }
    let vouchers: VoucherDisplay[] = [];
    if (primaryPass.orderId) {
        const voucherSnap = await adminDb
            .collection(COLLECTIONS.ISSUED_VOUCHERS)
            .where("orderId", "==", primaryPass.orderId)
            .get();
        console.log(`[ticket-wallet] Voucher query for orderId=${primaryPass.orderId}: found ${voucherSnap.size} vouchers`);
        vouchers = voucherSnap.docs.map((d) => {
            const v = d.data();
            return {
                id: d.id,
                code: v.code || "",
                templateName: v.templateName || "",
                status: v.status || "unknown",
                voucherType: v.voucherType || "",
            };
        });
    }

    return (
        <main className="min-h-screen bg-gradient-to-b pt-20 from-[#F8F6F0] to-[#F0EDE6]">
            {/* ── Top bar ───────────────────────────────────────────────── */}
            <div className="sticky top-0 z-10 px-4 py-3">
                <div className="max-w-md mx-auto flex items-center gap-3">
                    <Link
                        href={`/${locale}/orders`}
                        className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-[#1A1A2E] transition-colors"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        {t("backToOrders")}
                    </Link>
                </div>
            </div>

            <div className="max-w-md mx-auto px-4 py-8 space-y-6">
                {/* ── Hero header ──────────────────────────────────────── */}
                <div className="text-center space-y-2 pb-2">
                    <div className="flex items-center gap-2 justify-center">
                        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#1A1A2E] shadow-lg mb-3">
                            <span className="text-2xl">🎟️</span>
                        </div>
                        <h1 className="text-2xl font-extrabold text-[#1A1A2E] tracking-tight">
                            {t("pageTitle")}
                        </h1>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed max-w-xs mx-auto">
                        {t("pageSubtitle")}
                    </p>
                </div>

                {/* ── Order info badge ─────────────────────────────────── */}
                {allPasses.length > 1 && (
                    <div className="flex items-center justify-center gap-2 py-2">
                        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm">
                            <Ticket className="h-4 w-4 text-[#F5C842]" />
                            <span className="text-sm font-semibold text-[#1A1A2E]">
                                {allPasses.length} vé
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500 font-mono">
                                {primaryPass.orderNumber}
                            </span>
                        </div>
                    </div>
                )}

                {/* ── All pass cards ───────────────────────────────────── */}
                <div className="space-y-6">
                    {allPasses.map((pass, index) => (
                        <div key={pass.id} className="relative">
                            {/* Ticket counter */}
                            {allPasses.length > 1 && (
                                <div className="flex items-center justify-between mb-2 px-1">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        Vé {index + 1}/{allPasses.length}
                                    </span>
                                    {index === primaryIndex && (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-[#F5C842]/20 text-[#B8860B] rounded-full">
                                            Đang xem
                                        </span>
                                    )}
                                </div>
                            )}
                            <PassCard pass={pass} locale={locale} />
                        </div>
                    ))}
                </div>

                {/* ── Voucher cards ─────────────────────────────────────── */}
                {vouchers.length > 0 && (
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Gift className="h-4 w-4 text-[#F5C842]" />
                            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Voucher tặng kèm ({vouchers.length})
                            </span>
                        </div>
                        {vouchers.map((v) => (
                            <VoucherQRCard key={v.id} voucher={v} />
                        ))}
                    </div>
                )}

                {/* ── Usage tips ───────────────────────────────────────── */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-50 bg-gray-50/50">
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5 text-[#F5C842]" />
                            {t("usageTitle")}
                        </p>
                    </div>
                    <ul className="divide-y divide-gray-50">
                        <li className="flex items-start gap-3 px-4 py-3 text-sm text-gray-600">
                            <Smartphone className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            {t("usageTip1")}
                        </li>
                        <li className="flex items-start gap-3 px-4 py-3 text-sm text-gray-600">
                            <ShieldCheck className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            {t("usageTip2")}
                        </li>
                        <li className="flex items-start gap-3 px-4 py-3 text-sm text-gray-600">
                            <Eye className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
                            {t("usageTip3")}
                        </li>
                    </ul>
                </div>

                {/* ── Footer branding ───────────────────────────────────── */}
                <p className="text-center text-xs text-gray-400 pb-4">
                    B.Duck Cityfuns — Powered by Joy World Entertainment
                </p>
            </div>
        </main>
    );
}
