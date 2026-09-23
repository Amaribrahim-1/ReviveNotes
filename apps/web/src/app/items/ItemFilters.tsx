"use client";

import { ITEM_STATUSES, ITEM_TYPES, type Category, type ItemStatus, type ItemType, type Tag } from "@revivenotes/shared";
import { useQuery } from "@tanstack/react-query";
import { api, apiError } from "@/lib/api";
import { useItemFilters } from "./use-item-filters";

const fieldClass =
  "w-full rounded border border-neutral-300 px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

const statusLabel: Record<ItemStatus, string> = {
  inbox: "الوارد",
  active: "هشتغل عليها",
  done: "خلصت",
  archived: "أرشيف",
};

const typeLabel: Record<ItemType, string> = {
  text: "نص",
  link: "رابط",
  voice: "صوت",
  image: "صورة",
};

function readStatus(value: string): ItemStatus | "" {
  if (value === "inbox" || value === "active" || value === "done" || value === "archived") {
    return value;
  }
  return "";
}

function readType(value: string): ItemType | "" {
  if (value === "text" || value === "link" || value === "voice" || value === "image") {
    return value;
  }
  return "";
}

export default function ItemFilters() {
  const categoryId = useItemFilters((state) => state.categoryId);
  const status = useItemFilters((state) => state.status);
  const type = useItemFilters((state) => state.type);
  const tagIds = useItemFilters((state) => state.tagIds);
  const setCategoryId = useItemFilters((state) => state.setCategoryId);
  const setStatus = useItemFilters((state) => state.setStatus);
  const setType = useItemFilters((state) => state.setType);
  const toggleTag = useItemFilters((state) => state.toggleTag);

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

  const tags = useQuery({
    queryKey: ["tags"],
    retry: false,
    queryFn: async (): Promise<Tag[]> => {
      const response = await api("/tags");
      if (!response.ok) {
        throw new Error(await apiError(response));
      }
      return response.json() as Promise<Tag[]>;
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="filter-category">
          التصنيف
        </label>
        {categories.isPending ? <p>بنحمّل التصنيفات...</p> : null}
        {categories.isError ? (
          <p className="text-red-700" role="alert">
            {categories.error instanceof Error ? categories.error.message : "حصل خطأ. حاول تاني."}
          </p>
        ) : null}
        {categories.data ? (
          <select
            id="filter-category"
            className={fieldClass}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">الكل</option>
            {categories.data.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="filter-status">
          الحالة
        </label>
        <select
          id="filter-status"
          className={fieldClass}
          value={status}
          onChange={(event) => setStatus(readStatus(event.target.value))}
        >
          <option value="">الكل</option>
          {ITEM_STATUSES.map((itemStatus) => (
            <option key={itemStatus} value={itemStatus}>
              {statusLabel[itemStatus]}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="filter-type">
          النوع
        </label>
        <select
          id="filter-type"
          className={fieldClass}
          value={type}
          onChange={(event) => setType(readType(event.target.value))}
        >
          <option value="">الكل</option>
          {ITEM_TYPES.map((itemType) => (
            <option key={itemType} value={itemType}>
              {typeLabel[itemType]}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className="mb-1 text-sm font-medium">الوسوم</legend>
        {tags.isPending ? <p>بنحمّل الوسوم...</p> : null}
        {tags.isError ? (
          <p className="text-red-700" role="alert">
            {tags.error instanceof Error ? tags.error.message : "حصل خطأ. حاول تاني."}
          </p>
        ) : null}
        {tags.data && tags.data.length === 0 ? <p>لسه مفيش وسوم.</p> : null}
        {tags.data?.map((tag) => (
          <label key={tag.id} className="flex items-center gap-2 py-1">
            <input
              type="checkbox"
              checked={tagIds.includes(tag.id)}
              onChange={() => toggleTag(tag.id)}
              className="h-4 w-4"
            />
            <span>{tag.name}</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
