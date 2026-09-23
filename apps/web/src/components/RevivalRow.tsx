"use client";

import type { Item, RevivalList } from "@revivenotes/shared";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import ItemCard from "@/components/items/ItemCard";
import { api, apiError } from "@/lib/api";

const quietButtonClass =
  "rounded border border-neutral-300 px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";
const dangerButtonClass =
  "rounded border border-red-700 px-4 py-2 text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

type RevivalRowProps = {
  item: Item;
};

function dropFromRevival(queryClient: QueryClient, itemId: string) {
  queryClient.setQueryData<RevivalList>(["revival"], (current) => {
    if (!current) {
      return current;
    }
    return {
      items: current.items.filter((row) => row.id !== itemId),
    };
  });
}

export default function RevivalRow({ item }: RevivalRowProps) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<"revive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRevive() {
    setError(null);
    setPending("revive");
    try {
      const response = await api(`/items/${item.id}/revive`, { method: "POST" });
      if (!response.ok) {
        setError(await apiError(response));
        return;
      }
      dropFromRevival(queryClient, item.id);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["item", item.id] });
    } catch {
      setError("مش قادرين نوصل للسيرفر");
    } finally {
      setPending(null);
    }
  }

  async function onDelete() {
    setError(null);
    setPending("delete");
    try {
      const response = await api(`/items/${item.id}`, { method: "DELETE" });
      if (response.status !== 204) {
        setError(await apiError(response));
        return;
      }
      dropFromRevival(queryClient, item.id);
      queryClient.removeQueries({ queryKey: ["item", item.id] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["progress"] });
    } catch {
      setError("مش قادرين نوصل للسيرفر");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ItemCard item={item} />
      {confirming ? (
        <div className="flex flex-col gap-3">
          <p>الحذف نهائي والملاحظة مش هترجع.</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={dangerButtonClass} disabled={pending !== null} onClick={() => void onDelete()}>
              {pending === "delete" ? "بنحذف..." : "تأكيد الحذف"}
            </button>
            <button
              type="button"
              className={quietButtonClass}
              disabled={pending !== null}
              onClick={() => setConfirming(false)}
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={quietButtonClass} disabled={pending !== null} onClick={() => void onRevive()}>
            {pending === "revive" ? "بنحيي..." : "إحياء"}
          </button>
          <button type="button" className={dangerButtonClass} disabled={pending !== null} onClick={() => setConfirming(true)}>
            حذف نهائي
          </button>
        </div>
      )}
      {error ? (
        <p className="text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
