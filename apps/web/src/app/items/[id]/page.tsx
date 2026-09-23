"use client";

import { use } from "react";
import { SignedInShell } from "@/components/signed-in-shell";
import ItemDetail from "./ItemDetail";
import { titleClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

type ItemPageProps = {
  params: Promise<{ id: string }>;
};

export default function ItemPage({ params }: ItemPageProps) {
  const { id } = use(params);
  const { t } = useT();

  return (
    <SignedInShell>
      <h1 className={titleClass}>{t("note")}</h1>
      <ItemDetail itemId={id} />
    </SignedInShell>
  );
}
