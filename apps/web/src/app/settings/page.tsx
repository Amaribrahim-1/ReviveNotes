"use client";

import { SignedInShell } from "@/components/signed-in-shell";
import SettingsForm from "./SettingsForm";
import { titleClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

export default function SettingsPage() {
  const { t } = useT();

  return (
    <SignedInShell>
      <h1 className={titleClass}>{t("settings_title")}</h1>
      <SettingsForm />
    </SignedInShell>
  );
}
