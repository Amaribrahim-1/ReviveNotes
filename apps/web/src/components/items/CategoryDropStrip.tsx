"use client";

import type { Category } from "@revivenotes/shared";
import { useDroppable } from "@dnd-kit/core";
import { categoryColorClass } from "@/lib/category-colors";
import { knownCategoryColor } from "@/lib/category-colors";
import { useT } from "@/lib/use-t";

type CategoryChipProps = {
  category: Category;
  activeOverId: string | null;
};

function CategoryChip({ category, activeOverId }: CategoryChipProps) {
  const { setNodeRef, isOver } = useDroppable({ id: category.id });
  const highlighted = isOver || activeOverId === category.id;
  const color = knownCategoryColor(category.color);

  return (
    <div
      ref={setNodeRef}
      className={`flex shrink-0 cursor-default items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-150 ${
        highlighted
          ? "scale-110 border-rn-accent bg-rn-accent-soft shadow-md"
          : "border-rn-border bg-rn-surface text-rn-ink"
      }`}
    >
      {color ? (
        <span className={`size-2.5 shrink-0 rounded-full ${categoryColorClass[color]}`} aria-hidden="true" />
      ) : null}
      <span dir="auto" className="max-w-[120px] truncate">
        {category.name}
      </span>
    </div>
  );
}

type CategoryDropStripProps = {
  categories: Category[];
  isDragging: boolean;
  activeOverId: string | null;
};

export default function CategoryDropStrip({
  categories,
  isDragging,
  activeOverId,
}: CategoryDropStripProps) {
  const { t } = useT();

  return (
    <div
      aria-hidden="true"
      className={`overflow-x-auto transition-all duration-300 ${
        isDragging ? "mb-2 max-h-20 opacity-100" : "max-h-0 opacity-0 overflow-hidden"
      }`}
    >
      <div className="flex items-center gap-2 px-1 pb-2">
        <span className="shrink-0 text-xs text-rn-muted">{t("drag_to_category")}</span>
        {categories.map((cat) => (
          <CategoryChip key={cat.id} category={cat} activeOverId={activeOverId} />
        ))}
      </div>
    </div>
  );
}
