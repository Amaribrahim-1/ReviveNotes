"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/lib/use-theme";

export function AppToaster() {
  const theme = useTheme((state) => state.theme);

  return <Toaster dir="rtl" position="top-center" richColors closeButton theme={theme} />;
}
