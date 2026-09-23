"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useTheme } from "@/lib/use-theme";

type ThemeProviderProps = {
  children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  const hydrate = useTheme((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return children;
}
