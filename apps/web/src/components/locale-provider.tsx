"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useLocale } from "@/lib/use-locale";

type LocaleProviderProps = {
  children: ReactNode;
};

export function LocaleProvider({ children }: LocaleProviderProps) {
  const hydrate = useLocale((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return children;
}
