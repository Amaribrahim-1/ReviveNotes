"use client";

import type { Item, Category } from "@revivenotes/shared";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { useState, useCallback } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useT } from "@/lib/use-t";
import DropZoneBar from "./DropZoneBar";
import CategoryDropStrip from "./CategoryDropStrip";
import ItemCard from "./ItemCard";

/** Prefix we use for droppable zone IDs to tell them apart from category IDs. */
export const ZONE_DONE = "__zone_done__";
export const ZONE_ARCHIVE = "__zone_archive__";
export const ZONE_DELETE = "__zone_delete__";

type DragAndDropBoardProps = {
  /** The flat list of all rendered items (from all pages). */
  items: Item[];
  /** Resolved categories (may be empty or still loading – handled gracefully). */
  categories: Category[];
  /** Called when drag ends on the delete zone – opens the confirm modal for that item. */
  onRequestDelete: (item: Item) => void;
  children: ReactNode;
};

export default function DragAndDropBoard({
  items,
  categories,
  onRequestDelete,
  children,
}: DragAndDropBoardProps) {
  const { t } = useT();
  const queryClient = useQueryClient();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [activeOverId, setActiveOverId] = useState<string | null>(null);

  // 8 px movement before drag starts – prevents accidental drags on tap.
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  // TouchSensor with a small delay + tolerance for mobile.
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: { delay: 200, tolerance: 8 },
  });
  const sensors = useSensors(pointerSensor, touchSensor);

  const draggingItem = draggingId ? items.find((i) => i.id === draggingId) ?? null : null;

  function handleDragStart(event: DragStartEvent) {
    setDraggingId(String(event.active.id));
  }

  function handleDragOver(event: { over: { id: string | number } | null }) {
    setActiveOverId(event.over ? String(event.over.id) : null);
  }

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const itemId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : null;
      setDraggingId(null);
      setActiveOverId(null);

      if (!overId) return;
      const item = items.find((i) => i.id === itemId);
      if (!item) return;

      // ── Delete zone ──────────────────────────────────────────────────────
      if (overId === ZONE_DELETE) {
        onRequestDelete(item);
        return;
      }

      // ── Status zones ─────────────────────────────────────────────────────
      let newStatus: string | null = null;
      if (overId === ZONE_DONE) newStatus = "done";
      if (overId === ZONE_ARCHIVE) newStatus = "archived";

      if (newStatus) {
        if (item.status === newStatus) return; // no-op
        const toastId = toast.loading(t("saving"));
        try {
          const res = await api(`/items/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify({ status: newStatus }),
          });
          if (!res.ok) {
            toast.error(await apiError(res), { id: toastId });
            return;
          }
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["items"] }),
            queryClient.invalidateQueries({ queryKey: ["progress"] }),
            queryClient.invalidateQueries({ queryKey: ["revival"] }),
          ]);
          toast.success(t("saved"), { id: toastId });
        } catch {
          toast.error(t("offline"), { id: toastId });
        }
        return;
      }

      // ── Category drop strip ───────────────────────────────────────────────
      const category = categories.find((c) => c.id === overId);
      if (category) {
        if (item.category_id === category.id) return; // no-op
        const toastId = toast.loading(t("saving"));
        try {
          const res = await api(`/items/${item.id}`, {
            method: "PATCH",
            body: JSON.stringify({ category_id: category.id }),
          });
          if (!res.ok) {
            toast.error(await apiError(res), { id: toastId });
            return;
          }
          await queryClient.invalidateQueries({ queryKey: ["items"] });
          toast.success(t("saved"), { id: toastId });
        } catch {
          toast.error(t("offline"), { id: toastId });
        }
      }
    },
    [items, categories, onRequestDelete, queryClient, t],
  );

  return (
    <DndContext
      sensors={sensors}
      modifiers={[restrictToWindowEdges]}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      {/* Category chip strip – only visible when dragging */}
      {categories.length > 0 ? (
        <CategoryDropStrip categories={categories} isDragging={!!draggingId} activeOverId={activeOverId} />
      ) : null}

      {children}

      {/* Status / Delete drop zone bar – appears at the bottom while dragging */}
      <DropZoneBar isDragging={!!draggingId} activeOverId={activeOverId} />

      {/* Ghost card shown under the cursor while dragging */}
      <DragOverlay>
        {draggingItem ? (
          <div className="opacity-80 pointer-events-none rotate-2 scale-105 shadow-2xl">
            <ItemCard item={draggingItem} index={0} isDragOverlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
