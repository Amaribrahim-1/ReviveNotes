"use client";

import { CategoryManager } from "@/components/category-manager";
import { SignedInShell } from "@/components/signed-in-shell";
import { TagManager } from "@/components/tag-manager";
import { titleClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

export default function CategoriesPage() {
  const { t } = useT();

  return (
    <SignedInShell>
      <h1 className={titleClass}>{t("categories_title")}</h1>
      <CategoryManager />
      <TagManager />
    </SignedInShell>
  );
}
