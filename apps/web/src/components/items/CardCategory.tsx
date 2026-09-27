"use client";

import type { Category } from "@revivenotes/shared";
import { useQuery } from "@tanstack/react-query";
import { api, apiError } from "@/lib/api";
import { categoryColorClass } from "@/lib/category-colors";
import { useT } from "@/lib/use-t";

type CardCategoryProps = {
  categoryId: string | null;
};

/** A small category label in the top corner of a sticky note. */
export default function CardCategory({ categoryId }: CardCategoryProps) {
  const { t } = useT();
  // Every card shares this one cached query, so the list sends a single request.
  const categories = useQuery({
    queryKey: ["categories"],
    retry: false,
    queryFn: async (): Promise<Category[]> => {
      const response = await api("/categories");
      if (!response.ok) {
        throw new Error(await apiError(response));
      }
      return response.json() as Promise<Category[]>;
    },
  });

  if (categoryId === null || !categories.data) {
    return null;
  }
  const category = categories.data.find((row) => row.id === categoryId);
  if (!category) {
    return null;
  }

  return (
    <span
      title={category.name}
      className="pointer-events-none absolute top-2 end-3 z-10 flex max-w-[40%] items-center gap-1 rounded-full bg-rn-note-ink/10 px-2 py-0.5 text-xs text-rn-note-ink"
    >
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${categoryColorClass[category.color]}`} />
      <span className="sr-only">{t("category")}: </span>
      <span dir="auto" className="truncate">
        {category.name}
      </span>
    </span>
  );
}
