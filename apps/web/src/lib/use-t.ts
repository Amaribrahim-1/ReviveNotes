"use client";

import { tMsg, type Locale, type MsgKey } from "@revivenotes/shared";
import { tUi, type UiKey } from "@/lib/ui-copy";
import { useLocale } from "@/lib/use-locale";

export function useT() {
  const locale = useLocale((state) => state.locale);

  function t(key: UiKey): string {
    return tUi(locale, key);
  }

  function tm(key: string): string {
    return tMsg(locale, key);
  }

  return { locale, t, tm };
}

export function translateIssue(locale: Locale, message: string | undefined, fallback: MsgKey = "bad_data"): string {
  if (!message) {
    return tMsg(locale, fallback);
  }
  return tMsg(locale, message);
}
