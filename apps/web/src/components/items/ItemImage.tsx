"use client";

import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api, apiError } from "@/lib/api";
import { alertClass, mutedClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

type ItemImageProps = {
  itemId: string;
  size: "thumb" | "full";
};

const itemFileQuery = "item-file";

// The blob stays in TanStack Query. This map only keeps the object URL so a remount
// can point the img at it on the first paint, without asking the API again.
const objectUrls = new Map<string, string>();
const watchedClients = new WeakSet<QueryClient>();

function urlForItemFile(itemId: string, blob: Blob): string {
  const current = objectUrls.get(itemId);
  if (current) {
    return current;
  }
  const next = URL.createObjectURL(blob);
  objectUrls.set(itemId, next);
  return next;
}

function forgetItemFileUrl(itemId: string) {
  const current = objectUrls.get(itemId);
  if (!current) {
    return;
  }
  URL.revokeObjectURL(current);
  objectUrls.delete(itemId);
}

function watchItemFileCache(queryClient: QueryClient) {
  if (watchedClients.has(queryClient)) {
    return;
  }
  watchedClients.add(queryClient);
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "removed") {
      return;
    }
    const [name, itemId] = event.query.queryKey;
    if (name !== itemFileQuery || typeof itemId !== "string") {
      return;
    }
    forgetItemFileUrl(itemId);
  });
}

export default function ItemImage({ itemId, size }: ItemImageProps) {
  const { t } = useT();
  const queryClient = useQueryClient();

  useEffect(() => {
    watchItemFileCache(queryClient);
  }, [queryClient]);

  const file = useQuery({
    queryKey: [itemFileQuery, itemId],
    // The saved file does not change, so a later mount reuses this blob.
    staleTime: Infinity,
    // Same window the library uses before it drops an unused query.
    gcTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await api(`/items/${itemId}/file`, { signal });
      if (!response.ok) {
        throw new Error(await apiError(response));
      }
      return response.blob();
    },
  });

  if (file.isError) {
    const message = file.error instanceof Error ? file.error.message : t("image_load_error");
    return (
      <p className={alertClass} role="alert">
        {message}
      </p>
    );
  }

  if (!file.data) {
    return <p className={mutedClass}>{t("loading_image")}</p>;
  }

  const className =
    size === "thumb" ? "h-24 w-24 rounded-xl object-cover" : "h-auto w-full rounded-xl object-contain";

  return <img src={urlForItemFile(itemId, file.data)} alt={t("image_note_alt")} className={className} />;
}
