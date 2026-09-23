"use client";

import { SignedInShell } from "@/components/signed-in-shell";
import AllItemsList from "./AllItemsList";
import ItemFilters from "./ItemFilters";
import { surfacePanelClass, titleClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

export default function AllItemsPage() {
  const { t } = useT();

  return (
    <SignedInShell>
      <h1 className={titleClass}>{t("all_items_title")}</h1>
      <div className={surfacePanelClass}>
        <ItemFilters />
      </div>
      <AllItemsList />
    </SignedInShell>
  );
}
