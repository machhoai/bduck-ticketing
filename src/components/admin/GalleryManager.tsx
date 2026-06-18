"use client";

import { Plus, Trash2, Save, Image as ImageIcon, Loader2, UploadCloud } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { updateAttractionsGallery } from "@/actions/gallery";
import { storage } from "@/lib/firebase/client";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useState, useRef } from "react";

interface GalleryManagerProps {
    initialImages: string[];
    adminUid: string;
}

/**
 * Compress any browser-supported image to WebP using the Canvas API.
 * No external library needed — runs entirely in the browser.
 *
 * @param file  The source image file (any format the browser can decode)
 * @param quality  WebP quality 0–1 (default 0.85)
 * @returns A new File object in WebP format
 */
async function compressToWebP(file: File, quality = 0.85): Promise<File> {
    return new Promise((resolve, reject) => {
        const img = new window.Image();
        const objectUrl = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(objectUrl);

            // Draw original image onto a canvas at its natural size
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Canvas 2D context unavailable"));
                return;
            }
            ctx.drawImage(img, 0, 0);

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error("Canvas toBlob returned null"));
                        return;
                    }
                    // Derive a .webp filename from the original
                    const baseName = file.name.replace(/\.[^.]+$/, "");
                    resolve(new File([blob], `${baseName}.webp`, { type: "image/webp" }));
                },
                "image/webp",
                quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error(`Failed to load image: ${file.name}`));
        };

        img.src = objectUrl;
    });
}

export function GalleryManager({ initialImages, adminUid }: GalleryManagerProps) {
    const t = useTranslations("admin.gallery");
    const [images, setImages] = useState<string[]>(initialImages);
    const [newUrl, setNewUrl] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleAddUrl = () => {
        if (!newUrl.trim()) return;
        setImages([...images, newUrl.trim()]);
        setNewUrl("");
    };

    const handleRemove = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        // Size check runs against the ORIGINAL file (before compression)
        const validFiles: File[] = [];
        const MAX_SIZE = 20 * 1024 * 1024; // 20MB
        let skipped = 0;

        for (let i = 0; i < files.length; i++) {
            if (files[i].size > MAX_SIZE) {
                skipped++;
            } else {
                validFiles.push(files[i]);
            }
        }

        if (skipped > 0) {
            alert(`Đã bỏ qua ${skipped} file vì vượt quá dung lượng tối đa 20MB.`);
        }

        if (validFiles.length === 0) {
            if (fileInputRef.current) fileInputRef.current.value = "";
            return;
        }

        try {
            setIsUploading(true);

            const uploadPromises = validFiles.map(async (file) => {
                // 1. Compress to WebP (browser Canvas — no external library)
                const webpFile = await compressToWebP(file);

                // 2. Upload the compressed WebP to Firebase Storage
                const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
                const fileRef = ref(storage, `gallery/${uniqueId}_${webpFile.name}`);
                await uploadBytes(fileRef, webpFile, { contentType: "image/webp" });
                return getDownloadURL(fileRef);
            });

            // Wait for all uploads to complete
            const urls = await Promise.all(uploadPromises);
            setImages(prev => [...prev, ...urls]);
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error("Upload error:", error);
            alert("Lỗi tải một số ảnh lên. Vui lòng thử lại. Chi tiết: " + msg);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
            setIsUploading(false);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        const result = await updateAttractionsGallery(images, adminUid);
        setIsSaving(false);

        if (result.success) {
            alert("Đã lưu cấu hình thư viện hình ảnh thành công!");
        } else {
            alert("Lưu thất bại: " + result.error);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-[#1A1A2E]">{t("title")}</h2>
                    <p className="text-gray-500 text-sm mt-1">{t("subtitle")}</p>
                </div>
                <Button onClick={handleSave} disabled={isSaving || isUploading} className="gap-2">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {t("saveButton")}
                </Button>
            </div>

            <div className="flex flex-col md:flex-row gap-3 mb-8">
                <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <ImageIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block w-full pl-10 pr-3 py-2.5 md:py-2 border border-gray-200 rounded-xl leading-5 bg-gray-50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-duck-yellow focus:border-duck-yellow transition-colors sm:text-sm"
                        placeholder={t("inputPlaceholder")}
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleAddUrl()}
                    />
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={handleAddUrl} className="gap-2 shrink-0">
                        <Plus className="w-4 h-4" /> {t("addUrlButton")}
                    </Button>

                    <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        multiple
                    />
                    <Button
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2 shrink-0"
                        disabled={isUploading}
                    >
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
                        {isUploading ? t("uploading") : t("uploadButton")}
                    </Button>
                </div>
            </div>

            {images.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                    <ImageIcon className="mx-auto h-12 w-12 text-gray-300" />
                    <h3 className="mt-2 text-sm font-semibold text-gray-900">{t("emptyTitle")}</h3>
                    <p className="mt-1 text-sm text-gray-500">{t("emptySubtitle")}</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {images.map((url, i) => (
                        <div key={i} className="group relative aspect-square rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
                            {/* Fallback pattern if URL is invalid */}
                            <div className="absolute inset-0 flex items-center justify-center text-gray-300">
                                <ImageIcon className="w-8 h-8" />
                            </div>
                            <img
                                src={url}
                                alt={`Gallery image ${i}`}
                                className="absolute inset-0 z-10 h-full w-full object-cover"
                            />

                            {/* Hover overlay with delete button */}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
                                <button
                                    type="button"
                                    onClick={() => handleRemove(i)}
                                    className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-transform hover:scale-110 shadow-lg"
                                    aria-label="Xóa hình"
                                >
                                    <Trash2 className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-8 bg-amber-50 rounded-xl p-4 border border-amber-200 text-sm text-amber-800">
                <h4 className="font-bold flex items-center gap-2 mb-2">💡 {t("designTipsTitle").replace("💡 ", "")}</h4>
                <ul className="list-disc list-inside space-y-1">
                    <li><span dangerouslySetInnerHTML={{ __html: t("designTip1") }} /></li>
                    <li>{t("designTip2")}</li>
                    <li>{t("designTip3")}</li>
                </ul>
            </div>
        </div>
    );
}
