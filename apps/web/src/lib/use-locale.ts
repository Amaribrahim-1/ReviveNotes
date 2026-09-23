"use client";

import { create } from "zustand";
import type { Locale } from "@revivenotes/shared";
import { DEFAULT_LOCALE } from "@revivenotes/shared";
import { LOCALE_STORAGE_KEY, readStoredLocale } from "@/lib/locale-storage";

function applyLocale(locale: Locale) {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "en" ? "ltr" : "rtl";
}

type LocaleState = {
  locale: Locale;
  ready: boolean;
  hydrate: () => void;
  setLocale: (locale: Locale) => void;
  toggle: () => void;
};

export const useLocale = create<LocaleState>((set, get) => ({
  locale: DEFAULT_LOCALE,
  ready: false,
  hydrate: () => {
    const locale = readStoredLocale();
    applyLocale(locale);
    set({ locale, ready: true });
  },
  setLocale: (locale) => {
    try {
      window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Preference still applies for this tab.
    }
    applyLocale(locale);
    set({ locale });
  },
  toggle: () => {
    const next = get().locale === "en" ? "ar" : "en";
    get().setLocale(next);
  },
}));
