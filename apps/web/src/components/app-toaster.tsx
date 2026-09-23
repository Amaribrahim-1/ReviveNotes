"use client";

import { Toaster } from "sonner";
import { useLocale } from "@/lib/use-locale";
import { useTheme } from "@/lib/use-theme";

export function AppToaster() {
  const theme = useTheme((state) => state.theme);
  const locale = useLocale((state) => state.locale);

  return (
    <Toaster
      dir={locale === "en" ? "ltr" : "rtl"}
      position="top-center"
      richColors
      closeButton
      theme={theme}
    />
  );
}
