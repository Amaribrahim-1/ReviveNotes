"use client";

import { itemListQuerySchema, type ItemPage } from "@revivenotes/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api, apiError } from "@/lib/api";
import ItemCard from "./ItemCard";

const buttonClass =
  "rounded border border-neutral-300 px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

export default function ItemList() {
  const items = useInfiniteQuery({
    queryKey: ["items", "inbox"],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<ItemPage> => {
      const parsed = itemListQuerySchema.parse({
        status: "inbox",
        cursor: pageParam ?? undefined,
      });
      const params = new URLSearchParams();
      if (parsed.status) {
        params.set("status", parsed.status);
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
    return <p>بنحمّل الملاحظات...</p>;
  }

  if (items.isError) {
    return (
      <p className="text-red-700" role="alert">
        {items.error instanceof Error ? items.error.message : "حصل خطأ. حاول تاني."}
      </p>
    );
  }

  const rows = items.data.pages.flatMap((page) => page.items);

  return (
    <div className="flex flex-col gap-4">
      {rows.length === 0 ? (
        <p>تقدر تسجّل الملاحظة من غير تصنيف.</p>
      ) : (
        <ul className="flex list-none flex-col gap-3 p-0">
          {rows.map((item) => (
            <li key={item.id}>
              <ItemCard item={item} />
            </li>
          ))}
        </ul>
      )}
      {items.hasNextPage ? (
        <button
          type="button"
          onClick={() => {
            void items.fetchNextPage();
          }}
          disabled={items.isFetchingNextPage}
          className={buttonClass}
        >
          {items.isFetchingNextPage ? "بنحمّل..." : "اعرض المزيد"}
        </button>
      ) : null}
    </div>
  );
}
