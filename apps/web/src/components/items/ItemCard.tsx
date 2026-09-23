import type { Item } from "@revivenotes/shared";
import Link from "next/link";
import { formatVoiceDuration } from "./format-voice-duration";
import VoicePlayButton from "./VoicePlayButton";

type ItemCardProps = {
  item: Item;
};

export default function ItemCard({ item }: ItemCardProps) {
  if (item.type === "voice") {
    return (
      <article className="flex items-center justify-between gap-3 rounded border border-amber-200 bg-amber-50 p-4 shadow-sm">
        <Link
          href={`/items/${item.id}`}
          aria-label={`فتح الملاحظة، المدة ${formatVoiceDuration(item.duration_seconds)}`}
          dir="ltr"
          className="text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          {formatVoiceDuration(item.duration_seconds)}
        </Link>
        <VoicePlayButton itemId={item.id} />
      </article>
    );
  }

  return (
    <Link
      href={`/items/${item.id}`}
      className="block rounded border border-amber-200 bg-amber-50 p-4 shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
    >
      <p className={item.type === "link" ? "break-all" : "break-words"} dir={item.type === "link" ? "ltr" : undefined}>
        {cardText(item)}
      </p>
    </Link>
  );
}

function cardText(item: Item): string {
  switch (item.type) {
    case "text":
      return item.content.split(/\r?\n/)[0] ?? item.content;
    case "link":
      return item.content;
    default:
      return "النوع ده لسه مش متاح";
  }
}
