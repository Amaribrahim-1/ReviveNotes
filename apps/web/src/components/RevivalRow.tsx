"use client";

import type { Item, RevivalList } from "@revivenotes/shared";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import ItemCard from "@/components/items/ItemCard";
import { api, apiError } from "@/lib/api";
import { alertClass, buttonDangerClass, buttonSecondaryClass } from "@/lib/ui-classes";

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
    const toastId = toast.loading("بنحيي...");
    try {
      const response = await api(`/items/${item.id}/revive`, { method: "POST" });
      if (!response.ok) {
        const message = await apiError(response);
        setError(message);
        toast.error(message, { id: toastId });
        return;
      }
      dropFromRevival(queryClient, item.id);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["item", item.id] });
      toast.success("اتحييت", { id: toastId });
    } catch {
      setError("مش قادرين نوصل للسيرفر");
      toast.error("مش قادرين نوصل للسيرفر", { id: toastId });
    } finally {
      setPending(null);
    }
  }

  async function onDelete() {
    setError(null);
    setPending("delete");
    const toastId = toast.loading("بنحذف...");
    try {
      const response = await api(`/items/${item.id}`, { method: "DELETE" });
      if (response.status !== 204) {
        const message = await apiError(response);
        setError(message);
        toast.error(message, { id: toastId });
        return;
      }
      dropFromRevival(queryClient, item.id);
      queryClient.removeQueries({ queryKey: ["item", item.id] });
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      await queryClient.invalidateQueries({ queryKey: ["progress"] });
      toast.success("اتحذفت", { id: toastId });
    } catch {
      setError("مش قادرين نوصل للسيرفر");
      toast.error("مش قادرين نوصل للسيرفر", { id: toastId });
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
            <button type="button" className={buttonDangerClass} disabled={pending !== null} onClick={() => void onDelete()}>
              {pending === "delete" ? "بنحذف..." : "تأكيد الحذف"}
            </button>
            <button
              type="button"
              className={buttonSecondaryClass}
              disabled={pending !== null}
              onClick={() => setConfirming(false)}
            >
              إلغاء
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonSecondaryClass} disabled={pending !== null} onClick={() => void onRevive()}>
            {pending === "revive" ? "بنحيي..." : "إحياء"}
          </button>
          <button type="button" className={buttonDangerClass} disabled={pending !== null} onClick={() => setConfirming(true)}>
            حذف نهائي
          </button>
        </div>
      )}
      {error ? (
        <p className={alertClass} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
