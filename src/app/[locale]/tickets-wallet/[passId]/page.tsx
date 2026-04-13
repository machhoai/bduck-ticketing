// E-ticket page — RSC fetch pass, Client QR render (D2: no Storage)
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/client";
import { PassCard } from "@/components/customer/PassCard";
import type { PassDocument } from "@/types/firestore";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic"; // always fresh — no cache for tickets

interface PageProps {
  params: Promise<{ locale: string; passId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { passId } = await params;
  return {
    title: `Vé điện tử #${passId.slice(-8).toUpperCase()} — B.Duck Cityfuns`,
    robots: "noindex", // Private page — don't index
  };
}

export default async function ETicketPage({ params }: PageProps) {
  const { locale, passId } = await params;
  setRequestLocale(locale);

  const doc = await adminDb.collection(COLLECTIONS.PASSES).doc(passId).get();

  if (!doc.exists) notFound();

  const pass = { id: doc.id, ...doc.data() } as PassDocument;

  return (
    <main className="max-w-md mx-auto px-4 sm:px-6 py-10 space-y-6">
      {/* Back link */}
      <Link
        href={`/${locale}/orders`}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-[#1A1A2E] transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Đơn hàng của tôi
      </Link>

      <div>
        <h1 className="text-2xl font-extrabold text-[#1A1A2E]">
          🎟️ Vé điện tử
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Xuất trình QR code này tại cổng vào B.Duck Cityfuns.
        </p>
      </div>

      {/* PassCard — Client Component for QR rendering (D2) */}
      <PassCard pass={pass} />

      {/* Help text */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-700 space-y-1">
        <p className="font-semibold">💡 Lưu ý sử dụng vé</p>
        <ul className="space-y-1 list-disc list-inside text-xs">
          <li>Chụp màn hình hoặc lưu URL này để dùng offline.</li>
          <li>Một vé chỉ sử dụng được một lần.</li>
          <li>Không chia sẻ QR code với người khác.</li>
        </ul>
      </div>
    </main>
  );
}
