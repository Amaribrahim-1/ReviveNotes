"use client";

import type { Item } from "@revivenotes/shared";
import { Mic } from "lucide-react";
import Link from "next/link";
import { useT } from "@/lib/use-t";
import CardCategory from "./CardCategory";
import { formatVoiceDuration } from "./format-voice-duration";
import ItemImage from "./ItemImage";
import LinkPreviewCard from "./LinkPreviewCard";
import NotePin from "./NotePin";
import VoicePlayButton from "./VoicePlayButton";

type ItemCardProps = {
  item: Item;
  /** Place of the card in its list. It picks the note's tilt. */
  index: number;
};

// Five is not a multiple of 2, 3, or 4, so one board column does not repeat the same tilt all the way down.
const tilts = ["-rotate-1", "rotate-1", "-rotate-2", "rotate-1", "rotate-2"];

// From md up the board has several columns, so every note gets the same height (h-56).
// The line clamps below keep the longest content inside that height. Phones keep natural heights.
const noteClass =
  "relative rounded-sm text-rn-note-ink md:h-56 shadow-[0_10px_18px_-10px_rgb(0_0_0_/_0.45),0_1px_3px_rgb(0_0_0_/_0.1)] transition hover:rotate-0 hover:shadow-[0_16px_26px_-12px_rgb(0_0_0_/_0.5),0_2px_4px_rgb(0_0_0_/_0.1)] focus-within:rotate-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-rn-accent motion-reduce:rotate-0 motion-reduce:transition-none dark:shadow-[0_10px_20px_-8px_rgb(0_0_0_/_0.8)] dark:hover:shadow-[0_16px_28px_-10px_rgb(0_0_0_/_0.9)]";

export default function ItemCard({ item, index }: ItemCardProps) {
  const { t } = useT();
  const tilt = tilts[index % tilts.length];
  // A note with a category gets a taller top strip, so the category pill sits above the content.
  const hasCategory = item.category_id !== null;
  const paperPaddingClass = hasCategory ? "px-4 pt-9 pb-4" : "px-4 pt-6 pb-4";
  const photoPaddingClass = hasCategory ? "px-3 pt-9 pb-3" : "p-3";

  if (item.type === "image") {
    return (
      <Link
        href={`/items/${item.id}`}
        aria-label={t("open_image")}
        className={`block bg-rn-photo ${photoPaddingClass} md:flex md:flex-col ${noteClass} ${tilt}`}
      >
        <NotePin />
        <CardCategory categoryId={item.category_id} />
        <div className="flex aspect-[4/3] w-full items-center justify-center overflow-hidden bg-rn-note-ink/10 text-center text-sm md:aspect-auto md:min-h-0 md:flex-1">
          <ItemImage itemId={item.id} size="thumb" />
        </div>
        <div className="min-h-8 md:shrink-0">{cardNote(item.note)}</div>
      </Link>
    );
  }

  if (item.type === "voice") {
    return (
      <article className={`flex items-center justify-between gap-3 bg-rn-note-pink md:items-start ${paperPaddingClass} ${noteClass} ${tilt}`}>
        <NotePin />
        <CardCategory categoryId={item.category_id} />
        <Link
          href={`/items/${item.id}`}
          aria-label={`${t("open_note_duration")} ${formatVoiceDuration(item.duration_seconds)}`}
          className="min-w-0 flex-1 after:absolute after:inset-0 after:rounded-sm focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-rn-accent"
        >
          <p className="flex items-center gap-2 text-lg font-medium">
            <Mic className="size-5 shrink-0" aria-hidden="true" />
            <span dir="ltr" className="tabular-nums">
              {formatVoiceDuration(item.duration_seconds)}
            </span>
          </p>
          {cardNote(item.note)}
        </Link>
        {/* The link's after: layer covers the whole note. z-10 keeps the play button pressable above it. */}
        <div className="relative z-10">
          <VoicePlayButton itemId={item.id} />
        </div>
      </article>
    );
  }

  if (item.type === "text") {
    return (
      <Link
        href={`/items/${item.id}`}
        className={`block min-h-32 bg-rn-note-yellow ${paperPaddingClass} ${noteClass} ${tilt}`}
      >
        <NotePin />
        <CardCategory categoryId={item.category_id} />
        <p dir="auto" className="line-clamp-6 whitespace-pre-line break-words leading-relaxed">
          {item.content}
        </p>
      </Link>
    );
  }

  const preview = item.link_preview;
  const previewText = preview?.title ?? preview?.site_name ?? preview?.description ?? null;

  return (
    <Link
      href={`/items/${item.id}`}
      aria-label={preview && !previewText ? item.content : undefined}
      className={`block bg-rn-note-blue ${paperPaddingClass} ${noteClass} ${tilt}`}
    >
      <NotePin />
      <CardCategory categoryId={item.category_id} />
      {preview ? (
        <LinkPreviewCard preview={preview} />
      ) : (
        <p dir="ltr" className="break-all md:line-clamp-4">
          {item.content}
        </p>
      )}
      {cardNote(item.note)}
    </Link>
  );
}

function cardNote(note: string | null) {
  if (!note) {
    return null;
  }
  return (
    <p dir="auto" className="mt-3 line-clamp-2 break-words text-sm text-rn-note-ink/75 md:line-clamp-1">
      {note.split(/\r?\n/)[0] ?? note}
    </p>
  );
}
