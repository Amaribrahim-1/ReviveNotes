import { SignedInShell } from "@/components/signed-in-shell";
import AllItemsList from "./AllItemsList";
import ItemFilters from "./ItemFilters";

export default function AllItemsPage() {
  return (
    <SignedInShell>
      <h1 className="text-3xl font-semibold">كل الملاحظات</h1>
      <ItemFilters />
      <AllItemsList />
    </SignedInShell>
  );
}
