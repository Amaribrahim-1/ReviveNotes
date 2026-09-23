"use client";

import {
  itemListQuerySchema,
  type ItemPage,
  type ItemStatus,
  type ItemType,
} from "@revivenotes/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api, apiError } from "@/lib/api";
import { alertClass, buttonSecondaryClass, mutedClass } from "@/lib/ui-classes";
import ItemCard from "./ItemCard";

type ItemListProps = {
  status?: ItemStatus;
  type?: ItemType;
  categoryId?: string;
  tagIds?: string[];
  emptyText: string;
};

export default function ItemList({ status, type, categoryId, tagIds, emptyText }: ItemListProps) {
  const tags = [...(tagIds ?? [])].sort();
  const activeTags = tags.length > 0 ? tags : undefined;

  const items = useInfiniteQuery({
    queryKey: ["items", status ?? null, type ?? null, categoryId ?? null, activeTags ?? null],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<ItemPage> => {
      const parsed = itemListQuerySchema.parse({
        status,
        type,
        category_id: categoryId,
        tag: activeTags,
        cursor: pageParam ?? undefined,
      });
      const params = new URLSearchParams();
      if (parsed.status) {
        params.set("status", parsed.status);
      }
      if (parsed.type) {
        params.set("type", parsed.type);
      }
      if (parsed.category_id) {
        params.set("category_id", parsed.category_id);
      }
      for (const tagId of parsed.tag ?? []) {
        params.append("tag", tagId);
      }
      if (parsed.cursor) {
        params.set("cursor", parsed.cursor);
      }
      const response = await api(`/items?${params.toString()}`);
      if (!response.ok) {
        throw new Error(await apiError(response));
      }
      return response.json() as Promise<ItemPage>;
    },
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
  });

  if (items.isPending) {
    return <p className={mutedClass}>بنحمّل الملاحظات...</p>;
  }

  if (items.isError) {
    return (
      <p className={alertClass} role="alert">
        {items.error instanceof Error ? items.error.message : "حصل خطأ. حاول تاني."}
      </p>
    );
  }

  const rows = items.data.pages.flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <p className={mutedClass}>{emptyText}</p>
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {rows.map((item, index) => {
            const previous = rows[index - 1];
            const showDayLabel = previous === undefined || previous.local_date !== item.local_date;
            return (
              <li key={item.id} className="flex flex-col gap-2">
                {showDayLabel ? (
                  <h2 className={`text-sm font-medium ${mutedClass}`}>{dayLabel(item.local_date)}</h2>
                ) : null}
                <ItemCard item={item} />
              </li>
            );
          })}
        </ul>
      )}
      {items.hasNextPage ? (
        <button
          type="button"
          onClick={() => {
            void items.fetchNextPage();
          }}
          disabled={items.isFetchingNextPage}
          className={buttonSecondaryClass}
        >
          {items.isFetchingNextPage ? "بنحمّل..." : "اعرض المزيد"}
        </button>
      ) : null}
    </div>
  );
}

function dayLabel(localDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) {
    return localDate;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // local_date is already the user's calendar day. timeZone UTC prints that same year, month, and day.
  return new Intl.DateTimeFormat("ar", {
    numberingSystem: "latn",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
