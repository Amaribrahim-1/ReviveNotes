import { CategoryManager } from "@/components/category-manager";
import { SignedInShell } from "@/components/signed-in-shell";
import { TagManager } from "@/components/tag-manager";
import { titleClass } from "@/lib/ui-classes";

export default function CategoriesPage() {
  return (
    <SignedInShell>
      <h1 className={titleClass}>التصنيفات والوسوم</h1>
      <CategoryManager />
      <TagManager />
    </SignedInShell>
  );
}
