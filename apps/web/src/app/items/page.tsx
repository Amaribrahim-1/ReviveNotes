import { SignedInShell } from "@/components/signed-in-shell";
import AllItemsList from "./AllItemsList";
import ItemFilters from "./ItemFilters";
import { surfacePanelClass, titleClass } from "@/lib/ui-classes";

export default function AllItemsPage() {
  return (
    <SignedInShell>
      <h1 className={titleClass}>كل الملاحظات</h1>
      <div className={surfacePanelClass}>
        <ItemFilters />
      </div>
      <AllItemsList />
    </SignedInShell>
  );
}
