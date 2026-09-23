"use client";

import type { ReactNode } from "react";
import LanguageToggle from "@/components/LanguageToggle";
import ThemeToggle from "@/components/ThemeToggle";

type HeaderTogglesProps = {
  children?: ReactNode;
};

/** Theme then language, same place on every public header. */
export default function HeaderToggles({ children }: HeaderTogglesProps) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <ThemeToggle />
      <LanguageToggle />
      {children}
    </div>
  );
}
