import { SignedInShell } from "@/components/signed-in-shell";

export default function InboxPage() {
  return (
    <SignedInShell>
      <h1 className="text-3xl font-semibold">الوارد</h1>
      <p>دي صفحة الوارد المؤقتة.</p>
    </SignedInShell>
  );
}
