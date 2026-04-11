import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
    locales: ["vi", "en"],
    defaultLocale: "vi",
    localePrefix: "as-needed", // No prefix for default locale (vi), prefix for others (/en/...)
});

export type Locale = (typeof routing.locales)[number];
