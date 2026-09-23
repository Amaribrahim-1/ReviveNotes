import ItemList from "@/components/items/ItemList";
import { SignedInShell } from "@/components/signed-in-shell";
import CaptureForm from "./CaptureForm";
import { titleClass } from "@/lib/ui-classes";

export default function InboxPage() {
  return (
    <SignedInShell>
      <h1 className={titleClass}>الوارد</h1>
      <CaptureForm />
      <ItemList status="inbox" emptyText="تقدر تسجّل الملاحظة من غير تصنيف." />
    </SignedInShell>
  );
}
