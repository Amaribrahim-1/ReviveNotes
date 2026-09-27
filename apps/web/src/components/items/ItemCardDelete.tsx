"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { useT } from "@/lib/use-t";
import type { Item } from "@revivenotes/shared";
import DeleteConfirmModal from "./DeleteConfirmModal";

export default function ItemCardDelete({ item }: { item: Item }) {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const queryClient = useQueryClient();

  async function remove() {
    setPending(true);
    const toastId = toast.loading(t("deleting"));
    try {
      const response = await api(`/items/${item.id}`, { method: "DELETE" });
      if (response.status === 204) {
        queryClient.removeQueries({ queryKey: ["item", item.id] });
        await queryClient.invalidateQueries({ queryKey: ["items"] });
        await queryClient.invalidateQueries({ queryKey: ["progress"] });
        await queryClient.invalidateQueries({ queryKey: ["revival"] });
        toast.success(t("deleted"), { id: toastId });
        setIsOpen(false);
        return;
      }
      const message = await apiError(response);
      toast.error(message, { id: toastId });
    } catch {
      toast.error(t("offline"), { id: toastId });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={t("delete_forever")}
        className="p-1.5 cursor-pointer text-rn-note-ink/40 hover:text-rn-note-ink transition-colors rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rn-accent"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(true);
        }}
      >
        <Trash2 className="size-5" />
      </button>
      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={remove}
        pending={pending}
      />
    </>
  );
}
