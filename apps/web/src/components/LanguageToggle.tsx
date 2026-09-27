"use client";

import { Languages } from "lucide-react";
import { iconButtonClass } from "@/lib/ui-classes";
import { useLocale } from "@/lib/use-locale";
import { useT } from "@/lib/use-t";

export default function LanguageToggle() {
  const locale = useLocale((state) => state.locale);
  const ready = useLocale((state) => state.ready);
  const toggle = useLocale((state) => state.toggle);
  const { t } = useT();

  const label = locale === "en" ? t("lang_to_ar") : t("lang_to_en");
  // The label is written in the target language, so a screen reader must read it in that language.
  const labelLang = locale === "en" ? "ar" : "en";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!ready}
      aria-label={label}
      title={label}
      lang={labelLang}
      className={iconButtonClass}
    >
      <Languages className="size-5" aria-hidden="true" />
    </button>
  );
}
