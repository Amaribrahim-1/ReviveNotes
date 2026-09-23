"use client";

import { ITEM_STATUSES, ITEM_TYPES, type Category, type ItemStatus, type ItemType, type Tag } from "@revivenotes/shared";
import { useQuery } from "@tanstack/react-query";
import { api, apiError } from "@/lib/api";
import { alertClass, fieldClass, labelClass, mutedClass } from "@/lib/ui-classes";
import type { UiKey } from "@/lib/ui-copy";
import { useT } from "@/lib/use-t";
import { useItemFilters } from "./use-item-filters";

const statusKey: Record<ItemStatus, UiKey> = {
  inbox: "status_inbox",
  active: "status_active",
  done: "status_done",
  archived: "status_archived",
};

const typeKey: Record<ItemType, UiKey> = {
  text: "type_text",
  link: "type_link",
  voice: "type_voice",
  image: "type_image",
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
  const { t } = useT();
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
        <label className={labelClass} htmlFor="filter-category">
          {t("category")}
        </label>
        {categories.isPending ? <p className={mutedClass}>{t("loading_categories")}</p> : null}
        {categories.isError ? (
          <p className={alertClass} role="alert">
            {categories.error instanceof Error ? categories.error.message : t("generic_error")}
          </p>
        ) : null}
        {categories.data ? (
          <select
            id="filter-category"
            className={fieldClass}
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">{t("filter_all")}</option>
            {categories.data.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div>
        <label className={labelClass} htmlFor="filter-status">
          {t("status_label")}
        </label>
        <select
          id="filter-status"
          className={fieldClass}
          value={status}
          onChange={(event) => setStatus(readStatus(event.target.value))}
        >
          <option value="">{t("filter_all")}</option>
          {ITEM_STATUSES.map((itemStatus) => (
            <option key={itemStatus} value={itemStatus}>
              {t(statusKey[itemStatus])}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="filter-type">
          {t("type_label")}
        </label>
        <select
          id="filter-type"
          className={fieldClass}
          value={type}
          onChange={(event) => setType(readType(event.target.value))}
        >
          <option value="">{t("filter_all")}</option>
          {ITEM_TYPES.map((itemType) => (
            <option key={itemType} value={itemType}>
              {t(typeKey[itemType])}
            </option>
          ))}
        </select>
      </div>

      <fieldset className="flex flex-col gap-1">
        <legend className={labelClass}>{t("tag_legend")}</legend>
        {tags.isPending ? <p className={mutedClass}>{t("loading_tags")}</p> : null}
        {tags.isError ? (
          <p className={alertClass} role="alert">
            {tags.error instanceof Error ? tags.error.message : t("generic_error")}
          </p>
        ) : null}
        {tags.data && tags.data.length === 0 ? <p className={mutedClass}>{t("no_tags_yet")}</p> : null}
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
