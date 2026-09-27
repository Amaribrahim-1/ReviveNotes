"use client";

import {
  itemListQuerySchema,
  type ItemPage,
  type ItemStatus,
  type ItemType,
  type Category,
  type Item,
} from "@revivenotes/shared";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { api, apiError } from "@/lib/api";
import { alertClass, boardClass, buttonSecondaryClass, mutedClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";
import ItemCard from "./ItemCard";
import DeleteConfirmModal from "./DeleteConfirmModal";
import DragAndDropBoard from "./DragAndDropBoard";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type ItemListProps = {
  status?: ItemStatus;
  type?: ItemType;
  categoryId?: string;
  emptyText: string;
};

export default function ItemList({ status, type, categoryId, emptyText }: ItemListProps) {
  const { t, locale } = useT();
  const queryClient = useQueryClient();

  // Item selected for deletion via drag-to-delete zone.
  const [pendingDeleteItem, setPendingDeleteItem] = useState<Item | null>(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const items = useInfiniteQuery({
    queryKey: ["items", status ?? null, type ?? null, categoryId ?? null],
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }): Promise<ItemPage> => {
      const parsed = itemListQuerySchema.parse({
        status,
        type,
        category_id: categoryId,
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

  // Fetch categories for the drop strip.
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

  async function confirmDelete() {
    if (!pendingDeleteItem) return;
    setDeleting(true);
    const toastId = toast.loading(t("deleting"));
    try {
      const response = await api(`/items/${pendingDeleteItem.id}`, { method: "DELETE" });
      if (response.status === 204) {
        queryClient.removeQueries({ queryKey: ["item", pendingDeleteItem.id] });
        await queryClient.invalidateQueries({ queryKey: ["items"] });
        await queryClient.invalidateQueries({ queryKey: ["progress"] });
        await queryClient.invalidateQueries({ queryKey: ["revival"] });
        toast.success(t("deleted"), { id: toastId });
        setDeleteModalOpen(false);
        setPendingDeleteItem(null);
        return;
      }
      const message = await apiError(response);
      toast.error(message, { id: toastId });
    } catch {
      toast.error(t("offline"), { id: toastId });
    } finally {
      setDeleting(false);
    }
  }

  if (items.isPending) {
    return <p className={mutedClass}>{t("loading_items")}</p>;
  }

  if (items.isError) {
    return (
      <p className={alertClass} role="alert">
        {items.error instanceof Error ? items.error.message : t("generic_error")}
      </p>
    );
  }

  const rows = items.data.pages.flatMap((page) => page.items);
  const resolvedCategories = categories.data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <DragAndDropBoard
        items={rows}
        categories={resolvedCategories}
        onRequestDelete={(item) => {
          setPendingDeleteItem(item);
          setDeleteModalOpen(true);
        }}
      >
        {rows.length === 0 ? (
          <p className={mutedClass}>{emptyText}</p>
        ) : (
          <ul className={boardClass}>
            {rows.map((item, index) => {
              const previous = rows[index - 1];
              const showDayLabel = previous === undefined || previous.local_date !== item.local_date;
              return (
                <Fragment key={item.id}>
                  {showDayLabel ? (
                    <li className="col-span-full">
                      <h2 className={`text-sm font-medium ${mutedClass}`}>{dayLabel(item.local_date, locale)}</h2>
                    </li>
                  ) : null}
                  <li>
                    <ItemCard item={item} index={index} />
                  </li>
                </Fragment>
              );
            })}
          </ul>
        )}
      </DragAndDropBoard>

      {items.hasNextPage ? (
        <button
          type="button"
          onClick={() => {
            void items.fetchNextPage();
          }}
          disabled={items.isFetchingNextPage}
          className={`self-center ${buttonSecondaryClass}`}
        >
          {items.isFetchingNextPage ? t("loading") : t("show_more")}
        </button>
      ) : null}

      {/* Modal used when item is dragged to the delete zone */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          if (!deleting) {
            setDeleteModalOpen(false);
            setPendingDeleteItem(null);
          }
        }}
        onConfirm={confirmDelete}
        pending={deleting}
      />
    </div>
  );
}

function dayLabel(localDate: string, locale: "ar" | "en"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  if (!match) {
    return localDate;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  // local_date is already the user's calendar day. timeZone UTC prints that same year, month, and day.
  return new Intl.DateTimeFormat(locale === "en" ? "en" : "ar", {
    numberingSystem: "latn",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
