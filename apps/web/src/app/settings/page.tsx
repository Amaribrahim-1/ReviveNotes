import { SignedInShell } from "@/components/signed-in-shell";
import SettingsForm from "./SettingsForm";

export default function SettingsPage() {
  return (
    <SignedInShell>
      <h1 className="text-3xl font-semibold">الإعدادات</h1>
      <SettingsForm />
    </SignedInShell>
  );
}
