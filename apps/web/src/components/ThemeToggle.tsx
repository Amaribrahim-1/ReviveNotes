"use client";

import { buttonSecondaryClass } from "@/lib/ui-classes";
import { useTheme } from "@/lib/use-theme";
import { useT } from "@/lib/use-t";

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const theme = useTheme((state) => state.theme);
  const ready = useTheme((state) => state.ready);
  const toggle = useTheme((state) => state.toggle);
  const { t } = useT();

  const label = theme === "dark" ? t("theme_to_light") : t("theme_to_dark");

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!ready}
      aria-label={label}
      title={label}
      className={`${buttonSecondaryClass} shrink-0 px-3 py-2 text-sm ${className ?? ""}`}
    >
      {theme === "dark" ? t("theme_light") : t("theme_dark")}
    </button>
  );
}
