// Orders page — RSC shell.
// Fetches orders server-side, serializes Timestamps to ISO strings,
// then delegates ALL rendering to OrdersClient (client component).
import { setRequestLocale, getTranslations } from "next-intl/server";
import { getMyOrders } from "@/actions/orders";
import { Package } from "lucide-react";
import type { Metadata } from "next";
import type { OrderDocument } from "@/types/firestore";
import { NavbarConfigurator } from "@/components/layout/NavbarConfigurator";
import { OrdersClient, type SerializedOrder } from "./OrdersClient";

export const dynamic = "force-dynamic";

interface PageProps {
    params: Promise<{ locale: string }>;
}

export async function generateMetadata({
    params,
}: PageProps): Promise<Metadata> {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "orders" });
    return {
        title: `${t("pageTitle")} — B.Duck Cityfuns`,
        robots: "noindex",
    };
}

// ─── Serializer ───────────────────────────────────────────────────────────────
// Converts Firestore Timestamps → ISO strings so the object is safe to pass
// as a prop to a client component (Next.js requires plain-serializable props).

/* eslint-disable @typescript-eslint/no-explicit-any */
function serializeOrder(doc: OrderDocument): SerializedOrder {
    const d = doc as any;
    const toISO = (ts: any): string | null =>
        ts?.toDate?.()?.toISOString?.() ?? null;

    return {
        id: doc.id,
        status: doc.status,
        orderNumber: doc.orderNumber ?? "",
        items: (doc.items ?? []).map((i) => ({
            productName: i.productName,
            productType: (i as any).productType ?? "ticket",
            thumbnailUrl: (i as any).thumbnailUrl ?? "",
            quantity: i.quantity,
            subtotal: i.subtotal,
        })),
        finalAmount: doc.finalAmount ?? 0,
        discountAmount: doc.discountAmount ?? 0,
        promotionCode: doc.promotionCode,
        passIds: doc.passIds ?? [],
        createdAt: toISO(d.createdAt) ?? new Date().toISOString(),
        orderCode: d.orderCode ?? undefined,
        paymentProvider: d.paymentDetails?.provider ?? undefined,
        expiresAt: toISO(d.expiresAt),
    };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OrdersPage({ params }: PageProps) {
    const { locale } = await params;
    setRequestLocale(locale);

    const t = await getTranslations({ locale, namespace: "orders" });

    // D8: getMyOrders() reads session cookie server-side — never trusts client UID
    let orders: SerializedOrder[] = [];
    try {
        const docs = await getMyOrders();
        orders = docs.map(serializeOrder);
    } catch {
        // If fetch fails (network error, auth issue), client will show cached orders
        orders = [];
    }

    return (
        <main className="min-h-screen bg-gradient-to-b from-[#F8F6F0] to-white pt-20">
            <NavbarConfigurator solidBg={false} darkText shadow={false} />

            <div className="px-4 sm:px-6">
                {/* Page header */}
                <div className="bg-white border-b max-w-3xl px-4 sm:px-6 mx-auto rounded-2xl border-gray-100 shadow-sm">
                    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-[#1A1A2E] flex items-center justify-center shadow-lg flex-shrink-0">
                                <Package className="h-5 w-5 text-[#F5C842]" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-extrabold text-[#1A1A2E] tracking-tight">
                                    {t("pageTitle")}
                                </h1>
                                <p className="text-sm text-gray-500 mt-0.5">
                                    {t("pageSubtitle")}
                                </p>
                            </div>

                            {orders.length > 0 && (
                                <span className="ml-auto inline-flex items-center justify-center min-w-[2rem] h-8 px-2.5 rounded-full bg-[#F5C842] text-[#1A1A2E] text-sm font-extrabold shadow-sm">
                                    {orders.length}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content — delegated to client for localStorage + QR */}
                <div className="max-w-3xl mx-auto py-8">
                    <OrdersClient initialOrders={orders} locale={locale} />
                </div>
            </div>
        </main>
    );
}
