import { SignedInShell } from "@/components/signed-in-shell";
import SettingsForm from "./SettingsForm";
import { titleClass } from "@/lib/ui-classes";

export default function SettingsPage() {
  return (
    <SignedInShell>
      <h1 className={titleClass}>الإعدادات</h1>
      <SettingsForm />
    </SignedInShell>
  );
}
