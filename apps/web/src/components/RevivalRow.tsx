"use client";

import type { Item, RevivalList } from "@revivenotes/shared";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import ItemCard from "@/components/items/ItemCard";
import { api, apiError } from "@/lib/api";
import { alertClass, buttonDangerClass, buttonSecondaryClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

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
  const { t } = useT();
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState<"revive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onRevive() {
    setError(null);
    setPending("revive");
    const toastId = toast.loading(t("reviving"));
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
      toast.success(t("revived"), { id: toastId });
    } catch {
      setError(t("offline"));
      toast.error(t("offline"), { id: toastId });
    } finally {
      setPending(null);
    }
  }

  async function onDelete() {
    setError(null);
    setPending("delete");
    const toastId = toast.loading(t("deleting"));
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
      toast.success(t("deleted"), { id: toastId });
    } catch {
      setError(t("offline"));
      toast.error(t("offline"), { id: toastId });
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ItemCard item={item} />
      {confirming ? (
        <div className="flex flex-col gap-3">
          <p>{t("delete_forever_warn")}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonDangerClass} disabled={pending !== null} onClick={() => void onDelete()}>
              {pending === "delete" ? t("deleting") : t("confirm_delete")}
            </button>
            <button
              type="button"
              className={buttonSecondaryClass}
              disabled={pending !== null}
              onClick={() => setConfirming(false)}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonSecondaryClass} disabled={pending !== null} onClick={() => void onRevive()}>
            {pending === "revive" ? t("reviving") : t("revive")}
          </button>
          <button type="button" className={buttonDangerClass} disabled={pending !== null} onClick={() => setConfirming(true)}>
            {t("delete_forever")}
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
