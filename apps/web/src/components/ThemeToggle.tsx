"use client";

import { Moon, Sun } from "lucide-react";
import { iconButtonClass } from "@/lib/ui-classes";
import { useTheme } from "@/lib/use-theme";
import { useT } from "@/lib/use-t";

export default function ThemeToggle() {
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
      className={iconButtonClass}
    >
      {theme === "dark" ? (
        <Sun className="size-5" aria-hidden="true" />
      ) : (
        <Moon className="size-5" aria-hidden="true" />
      )}
    </button>
  );
}
