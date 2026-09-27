"use client";

import ItemList from "@/components/items/ItemList";
import { SignedInShell } from "@/components/signed-in-shell";
import CaptureForm from "./CaptureForm";
import { titleClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

export default function InboxPage() {
  const { t } = useT();

  return (
    <SignedInShell wide>
      <h1 className={titleClass}>{t("inbox_title")}</h1>
      <div className="w-full max-w-2xl">
        <CaptureForm />
      </div>
      <ItemList status="inbox" emptyText={t("inbox_empty_hint")} />
    </SignedInShell>
  );
}
