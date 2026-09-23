import type { Locale } from "@revivenotes/shared";
import { DEFAULT_LOCALE } from "@revivenotes/shared";

export const LOCALE_STORAGE_KEY = "rn-locale";

export function readStoredLocale(): Locale {
  try {
    const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored === "en" || stored === "ar") {
      return stored;
    }
  } catch {
    // Private mode can block localStorage. Stay on Arabic.
  }
  return DEFAULT_LOCALE;
}
