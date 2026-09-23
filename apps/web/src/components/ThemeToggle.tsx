"use client";

import { buttonSecondaryClass } from "@/lib/ui-classes";
import { useTheme } from "@/lib/use-theme";

type ThemeToggleProps = {
  className?: string;
};

export default function ThemeToggle({ className }: ThemeToggleProps) {
  const theme = useTheme((state) => state.theme);
  const ready = useTheme((state) => state.ready);
  const toggle = useTheme((state) => state.toggle);

  const label = theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={!ready}
      aria-label={label}
      title={label}
      className={`${buttonSecondaryClass} shrink-0 px-3 py-2 text-sm ${className ?? ""}`}
    >
      {theme === "dark" ? "فاتح" : "داكن"}
    </button>
  );
}
