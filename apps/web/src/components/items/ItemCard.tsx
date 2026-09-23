"use client";

import type { Item } from "@revivenotes/shared";
import Link from "next/link";
import { cardClass, mutedClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";
import { formatVoiceDuration } from "./format-voice-duration";
import ItemImage from "./ItemImage";
import LinkPreviewCard from "./LinkPreviewCard";
import VoicePlayButton from "./VoicePlayButton";

type ItemCardProps = {
  item: Item;
};

export default function ItemCard({ item }: ItemCardProps) {
  const { t } = useT();

  if (item.type === "image") {
    return (
      <Link href={`/items/${item.id}`} aria-label={t("open_image")} className={`block ${cardClass}`}>
        <ItemImage itemId={item.id} size="thumb" />
        {cardNote(item.note)}
      </Link>
    );
  }

  if (item.type === "voice") {
    return (
      <article className={`flex items-center justify-between gap-3 ${cardClass}`}>
        <Link
          href={`/items/${item.id}`}
          aria-label={`${t("open_note_duration")} ${formatVoiceDuration(item.duration_seconds)}`}
          className="min-w-0 flex-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rn-accent"
        >
          <p dir="ltr" className="text-lg font-medium tabular-nums">
            {formatVoiceDuration(item.duration_seconds)}
          </p>
          {cardNote(item.note)}
        </Link>
        <VoicePlayButton itemId={item.id} />
      </article>
    );
  }

  const preview = item.type === "link" ? item.link_preview : null;
  const previewText = preview?.title ?? preview?.site_name ?? preview?.description ?? null;

  return (
    <Link
      href={`/items/${item.id}`}
      aria-label={preview && !previewText ? item.content : undefined}
      className={`block ${cardClass}`}
    >
      {preview ? (
        <LinkPreviewCard preview={preview} />
      ) : (
        <p
          className={item.type === "link" ? "break-all" : "break-words leading-relaxed"}
          dir={item.type === "link" ? "ltr" : undefined}
        >
          {cardText(item, t("type_unknown").replace(/\.$/, ""))}
        </p>
      )}
      {item.type === "link" ? cardNote(item.note) : null}
    </Link>
  );
}

function cardText(item: Item, unknownLabel: string): string {
  switch (item.type) {
    case "text":
      return item.content.split(/\r?\n/)[0] ?? item.content;
    case "link":
      return item.content;
    default:
      return unknownLabel;
  }
}

function cardNote(note: string | null) {
  if (!note) {
    return null;
  }
  return <p className={`mt-2 break-words text-sm ${mutedClass}`}>{note.split(/\r?\n/)[0] ?? note}</p>;
}
