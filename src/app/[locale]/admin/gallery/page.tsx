import { getTranslations } from "next-intl/server";
import { getAttractionsGallery } from "@/actions/gallery";
import { GalleryManager } from "@/components/admin/GalleryManager";
import { requireAdmin } from "@/lib/auth/session";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({ locale });
  return {
    title: `Quản lý Thư viện Ảnh | B.Duck Admin`,
  };
}

export default async function AdminGalleryPage() {
  const adminDoc = await requireAdmin();
  const initialImages = await getAttractionsGallery();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-[#1A1A2E] tracking-tight">Thư viện Ảnh Attractions</h1>
        <p className="mt-2 text-gray-500 max-w-2xl">
          Quản lý hình ảnh hiển thị trên dải Banner cuộn ở trang chủ (phần B.Duck Funland). Các thay đổi ở đây sẽ cập nhật trực tiếp lên màn hình của khách hàng.
        </p>
      </div>

      <GalleryManager initialImages={initialImages} adminUid={adminDoc.uid} />
    </div>
  );
}
