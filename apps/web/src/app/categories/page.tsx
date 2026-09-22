import { CategoryManager } from "@/components/category-manager";
import { SignedInShell } from "@/components/signed-in-shell";
import { TagManager } from "@/components/tag-manager";

export default function CategoriesPage() {
  return (
    <SignedInShell>
      <h1 className="text-3xl font-semibold">التصنيفات والوسوم</h1>
      <CategoryManager />
      <TagManager />
    </SignedInShell>
  );
}
