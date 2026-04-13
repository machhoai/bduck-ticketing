import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
    images: {
        formats: ["image/avif", "image/webp"],
        remotePatterns: [
            // Firebase Storage (Admin SDK upload)
            {
                protocol: "https",
                hostname: "storage.googleapis.com",
                pathname: "/**",
            },
            // Firebase Storage (direct bucket URL)
            {
                protocol: "https",
                hostname: "*.firebasestorage.app",
                pathname: "/**",
            },
            // ImgBB (fallback for when Storage isn't set up)
            {
                protocol: "https",
                hostname: "i.ibb.co",
                pathname: "/**",
            },
            // Cloudinary
            {
                protocol: "https",
                hostname: "res.cloudinary.com",
                pathname: "/**",
            },
        ],
    },
    // firebase-admin uses native Node.js modules that cannot be bundled by
    // Turbopack/Webpack. Mark them as external so Next.js requires them at
    // runtime from node_modules instead of attempting to bundle them.
    serverExternalPackages: [
        "firebase-admin",
        "@google-cloud/firestore",
        "@google-cloud/storage",
        "@opentelemetry/api",
    ],
};

export default withNextIntl(nextConfig);
