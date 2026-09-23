import { SignedInShell } from "@/components/signed-in-shell";
import ItemDetail from "./ItemDetail";
import { titleClass } from "@/lib/ui-classes";

type ItemPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ItemPage({ params }: ItemPageProps) {
  const { id } = await params;

  return (
    <SignedInShell>
      <h1 className={titleClass}>الملاحظة</h1>
      <ItemDetail itemId={id} />
    </SignedInShell>
  );
}
