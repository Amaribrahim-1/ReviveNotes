import { SignedInShell } from "@/components/signed-in-shell";
import CaptureForm from "./CaptureForm";
import ItemList from "./ItemList";

export default function InboxPage() {
  return (
    <SignedInShell>
      <h1 className="text-3xl font-semibold">الوارد</h1>
      <CaptureForm />
      <ItemList />
    </SignedInShell>
  );
}
