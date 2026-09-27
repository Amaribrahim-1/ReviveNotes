"use client";

import { useDroppable } from "@dnd-kit/core";
import { Archive, CheckCircle2, Trash2 } from "lucide-react";
import { useT } from "@/lib/use-t";
import { ZONE_DONE, ZONE_ARCHIVE, ZONE_DELETE } from "./DragAndDropBoard";

type DropZoneBarProps = {
  isDragging: boolean;
  activeOverId: string | null;
};

function Zone({
  id,
  icon: Icon,
  label,
  colorClass,
  activeOverId,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  colorClass: string;
  activeOverId: string | null;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const highlighted = isOver || activeOverId === id;

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-1 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed py-4 text-sm font-medium transition-all duration-150 ${
        highlighted
          ? `${colorClass} scale-105 shadow-lg`
          : "border-rn-border bg-rn-surface/60 text-rn-muted"
      }`}
    >
      <Icon className="size-6" aria-hidden={true} />
      <span>{label}</span>
    </div>
  );
}

export default function DropZoneBar({ isDragging, activeOverId }: DropZoneBarProps) {
  const { t } = useT();

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-x-0 bottom-16 z-30 mx-auto flex max-w-2xl gap-3 px-4 pb-2 transition-all duration-300 md:bottom-4 ${
        isDragging
          ? "pointer-events-auto translate-y-0 opacity-100"
          : "pointer-events-none translate-y-4 opacity-0"
      }`}
    >
      <Zone
        id={ZONE_DONE}
        icon={CheckCircle2}
        label={t("status_done")}
        colorClass="border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
        activeOverId={activeOverId}
      />
      <Zone
        id={ZONE_ARCHIVE}
        icon={Archive}
        label={t("status_archived")}
        colorClass="border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
        activeOverId={activeOverId}
      />
      <Zone
        id={ZONE_DELETE}
        icon={Trash2}
        label={t("delete")}
        colorClass="border-red-500 bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300"
        activeOverId={activeOverId}
      />
    </div>
  );
}
