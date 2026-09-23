"use client";

import { buttonSecondaryClass } from "@/lib/ui-classes";
import { useLocale } from "@/lib/use-locale";
import { useT } from "@/lib/use-t";

type LanguageToggleProps = {
  className?: string;
};

export default function LanguageToggle({ className }: LanguageToggleProps) {
  const locale = useLocale((state) => state.locale);
  const ready = useLocale((state) => state.ready);
  const toggle = useLocale((state) => state.toggle);
  const { t } = useT();

  const label = locale === "en" ? t("lang_to_ar") : t("lang_to_en");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!ready}
      aria-label={label}
      title={label}
      className={`${buttonSecondaryClass} shrink-0 px-3 py-2 text-sm ${className ?? ""}`}
    >
      {label}
    </button>
  );
}
