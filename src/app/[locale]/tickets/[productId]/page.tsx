import Image from "next/image";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getProductById } from "@/actions/products";
import { serializeProduct } from "@/lib/serializeProduct";
import { AddToCartButton } from "@/components/customer/AddToCartButton";
import { Badge } from "@/components/ui";
import { Calendar, Clock, Package, CheckCircle } from "lucide-react";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ locale: string; productId: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { productId } = await params;
  const product = await getProductById(productId);
  if (!product) return { title: "Không tìm thấy sản phẩm" };
  return {
    title: `${product.name} — B.Duck Cityfuns`,
    description: product.description,
    openGraph: {
      images: [product.thumbnailUrl],
    },
  };
}

function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { locale, productId } = await params;
  setRequestLocale(locale);

  const product = await getProductById(productId);
  if (!product || product.status === "hidden") notFound();

  // Serialize for RSC→CC boundary
  const clientProduct = serializeProduct(product);

  const isSoldOut = product.status === "sold-out";
  const isCombo = product.type === "combo";

  // Effective price
  let effectivePrice = product.price;
  let isOnSale = false;
  if (product.flashSale) {
    const now = Date.now();
    if (
      now >= product.flashSale.startAt.toMillis() &&
      now <= product.flashSale.endAt.toMillis()
    ) {
      effectivePrice = product.flashSale.salePrice;
      isOnSale = true;
    }
  }

  // Validity label
  let validityLabel = "";
  const v = product.validityConfig;
  if (v.type === "date-specific") validityLabel = "Vé ngày cụ thể";
  else if (v.type === "date-range")
    validityLabel = `Có giá trị ${v.validDaysFromPurchase} ngày kể từ ngày mua`;
  else validityLabel = "Không giới hạn ngày";

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
        {/* Left: Image gallery */}
        <div className="space-y-3">
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-lg">
            <Image
              src={product.thumbnailUrl}
              alt={product.name}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, 50vw"
            />
            <div className="absolute top-3 left-3 flex gap-2 flex-wrap">
              {isCombo && <Badge variant="combo">Combo</Badge>}
              {isOnSale && <Badge variant="sale">Flash Sale</Badge>}
              {isSoldOut && <Badge variant="soldout">Hết vé</Badge>}
            </div>
          </div>
          {/* Gallery thumbnails */}
          {product.gallery && product.gallery.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {product.gallery.slice(0, 4).map((url, i) => (
                <div
                  key={i}
                  className="relative aspect-square rounded-xl overflow-hidden"
                >
                  <Image
                    src={url}
                    alt={`${product.name} ảnh ${i + 2}`}
                    fill
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Product info */}
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-extrabold text-[#1A1A2E] leading-tight">
              {product.name}
            </h1>
            <p className="text-gray-500 mt-2 leading-relaxed">
              {product.description}
            </p>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-[#1A1A2E]">
              {formatVND(effectivePrice)}
            </span>
            {isOnSale && (
              <span className="text-lg text-gray-400 line-through">
                {formatVND(product.price)}
              </span>
            )}
          </div>

          {/* Info chips */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              {v.type === "date-specific" ? (
                <Calendar className="h-4 w-4 text-[#F5C842] flex-shrink-0" />
              ) : v.type === "date-range" ? (
                <Clock className="h-4 w-4 text-[#F5C842] flex-shrink-0" />
              ) : (
                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
              )}
              {validityLabel}
            </div>

            {product.totalStock !== undefined && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Package className="h-4 w-4 text-[#F5C842] flex-shrink-0" />
                Còn lại:{" "}
                <strong>
                  {Math.max(0, product.totalStock - product.soldCount)} vé
                </strong>
              </div>
            )}
          </div>

          {/* Combo items */}
          {isCombo && product.comboItems && product.comboItems.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="font-bold text-amber-900 text-sm mb-2">
                Combo bao gồm:
              </p>
              <ul className="space-y-1.5">
                {product.comboItems.map((item, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-amber-800"
                  >
                    <span className="w-2 h-2 rounded-full bg-[#F5C842] flex-shrink-0" />
                    {item.productName} × {item.quantity}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* CTA */}
          <AddToCartButton product={clientProduct} disabled={isSoldOut} />

          {/* Trust signals */}
          <p className="text-xs text-gray-400 text-center">
            🔒 Thanh toán an toàn · 📧 Nhận vé qua email · QR code tức thì
          </p>
        </div>
      </div>
    </main>
  );
}
