"use client";

import { updateItemSchema, type Item, type UpdateItemInput } from "@revivenotes/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { formatVoiceDuration } from "@/components/items/format-voice-duration";
import ItemImage from "@/components/items/ItemImage";
import LinkPreviewCard from "@/components/items/LinkPreviewCard";
import VoicePlayButton from "@/components/items/VoicePlayButton";
import { api, apiError } from "@/lib/api";
import {
  alertClass,
  cardClass,
  linkClass,
  mutedClass,
} from "@/lib/ui-classes";
import ItemCategoryField from "./ItemCategoryField";
import ItemContentForm from "./ItemContentForm";
import ItemDeleteButton from "./ItemDeleteButton";
import ItemNoteForm from "./ItemNoteForm";
import ItemStatusControls from "./ItemStatusControls";
import ItemTagField from "./ItemTagField";

type ItemDetailProps = {
  itemId: string;
};

export default function ItemDetail({ itemId }: ItemDetailProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const item = useQuery({
    queryKey: ["item", itemId],
    retry: false,
    queryFn: async (): Promise<Item> => {
      const response = await api(`/items/${itemId}`);
      if (!response.ok) {
        throw new Error(await apiError(response));
      }
      return response.json() as Promise<Item>;
    },
  });

  async function save(patch: UpdateItemInput) {
    setError(null);
    const parsed = updateItemSchema.safeParse(patch);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "راجع البيانات";
      setError(message);
      toast.error(message);
      return;
    }

    setPending(true);
    const toastId = toast.loading("بنحفظ...");
    try {
      const response = await api(`/items/${itemId}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const message = await apiError(response);
        setError(message);
        toast.error(message, { id: toastId });
        return;
      }
      const updated = (await response.json()) as Item;
      queryClient.setQueryData(["item", itemId], updated);
      await queryClient.invalidateQueries({ queryKey: ["items"] });
      if (parsed.data.status !== undefined) {
        await queryClient.invalidateQueries({ queryKey: ["progress"] });
      }
      toast.success("اتحفظت", { id: toastId });
    } catch {
      setError("مش قادرين نوصل للسيرفر");
      toast.error("مش قادرين نوصل للسيرفر", { id: toastId });
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setError(null);
    setPending(true);
    const toastId = toast.loading("بنحذف...");
    try {
      const response = await api(`/items/${itemId}`, { method: "DELETE" });
      if (response.status === 204) {
        queryClient.removeQueries({ queryKey: ["item", itemId] });
        await queryClient.invalidateQueries({ queryKey: ["items"] });
        await queryClient.invalidateQueries({ queryKey: ["progress"] });
        toast.success("اتحذفت", { id: toastId });
        router.push("/inbox");
        return;
      }
      const message = await apiError(response);
      setError(message);
      toast.error(message, { id: toastId });
    } catch {
      setError("مش قادرين نوصل للسيرفر");
      toast.error("مش قادرين نوصل للسيرفر", { id: toastId });
    } finally {
      setPending(false);
    }
  }

  if (item.isPending) {
    return <p className={mutedClass}>بنحمّل الملاحظة...</p>;
  }

  if (item.isError || !item.data) {
    return (
      <p className={alertClass} role="alert">
        {item.error instanceof Error ? item.error.message : "حصل خطأ. حاول تاني."}
      </p>
    );
  }

  let body: ReactNode;
  if (item.data.type === "text" || item.data.type === "link") {
    body = (
      <>
        {item.data.type === "link" && item.data.link_preview ? (
          <div className="-mx-4 -mt-4 overflow-hidden">
            <LinkPreviewCard preview={item.data.link_preview} large />
          </div>
        ) : null}
        {item.data.type === "link" ? linkBody(item.data.content) : null}
        <ItemContentForm
          key={`${item.data.id}:${item.data.content}`}
          item={item.data}
          pending={pending}
          onSave={(patch) => {
            void save(patch);
          }}
          onInvalid={(message) => {
            setError(message);
            if (message) {
              toast.error(message);
            }
          }}
        />
      </>
    );
  } else if (item.data.type === "image") {
    body = <ItemImage itemId={item.data.id} size="full" />;
  } else if (item.data.type === "voice") {
    body = (
      <div className="flex items-center justify-between gap-3">
        <p dir="ltr" className="text-lg font-medium tabular-nums">
          {formatVoiceDuration(item.data.duration_seconds)}
        </p>
        <VoicePlayButton itemId={item.data.id} />
      </div>
    );
  } else {
    body = <p>النوع ده لسه مش متاح.</p>;
  }

  const showNote = item.data.type === "link" || item.data.type === "image" || item.data.type === "voice";

  return (
    <article className={`flex flex-col gap-6 ${cardClass}`}>
      {body}
      {showNote ? (
        <ItemNoteForm
          key={`${item.data.id}:${item.data.note ?? ""}`}
          item={item.data}
          pending={pending}
          onSave={(patch) => {
            void save(patch);
          }}
          onInvalid={(message) => {
            setError(message);
            if (message) {
              toast.error(message);
            }
          }}
        />
      ) : null}
      {error ? (
        <p className={alertClass} role="alert">
          {error}
        </p>
      ) : null}
      <ItemStatusControls
        item={item.data}
        pending={pending}
        onSave={(patch) => {
          void save(patch);
        }}
      />
      <ItemCategoryField
        item={item.data}
        pending={pending}
        onSave={(patch) => {
          void save(patch);
        }}
      />
      <ItemTagField
        item={item.data}
        pending={pending}
        onSave={(patch) => {
          void save(patch);
        }}
      />
      <ItemDeleteButton pending={pending} onDelete={() => void remove()} />
    </article>
  );
}

function linkBody(content: string): ReactNode {
  const href = httpHref(content);
  if (!href) {
    return (
      <p className="break-all" dir="ltr">
        {content}
      </p>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      dir="ltr"
      className={`break-all ${linkClass}`}
    >
      {content}
    </a>
  );
}

function httpHref(content: string): string | null {
  try {
    const url = new URL(content);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return null;
  }
  return null;
}
