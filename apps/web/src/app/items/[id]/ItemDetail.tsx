"use client";

import type { Item } from "@revivenotes/shared";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api, apiError } from "@/lib/api";

type ItemDetailProps = {
  itemId: string;
};

export default function ItemDetail({ itemId }: ItemDetailProps) {
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

  if (item.isPending) {
    return <p>بنحمّل الملاحظة...</p>;
  }

  if (item.isError || !item.data) {
    return (
      <p className="text-red-700" role="alert">
        {item.error instanceof Error ? item.error.message : "حصل خطأ. حاول تاني."}
      </p>
    );
  }

  let body: ReactNode;
  switch (item.data.type) {
    case "text":
      body = <p className="whitespace-pre-wrap break-words">{item.data.content}</p>;
      break;
    case "link":
      body = linkBody(item.data.content);
      break;
    default:
      body = <p>النوع ده لسه مش متاح.</p>;
      break;
  }

  return <article className="rounded border border-amber-200 bg-amber-50 p-4">{body}</article>;
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
      className="break-all underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
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
