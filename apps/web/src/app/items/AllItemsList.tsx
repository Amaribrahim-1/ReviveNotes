"use client";

import ItemList from "@/components/items/ItemList";
import { useT } from "@/lib/use-t";
import { useItemFilters } from "./use-item-filters";

export default function AllItemsList() {
  const { t } = useT();
  const categoryId = useItemFilters((state) => state.categoryId);
  const status = useItemFilters((state) => state.status);
  const type = useItemFilters((state) => state.type);

  return (
    <ItemList
      categoryId={categoryId || undefined}
      status={status || undefined}
      type={type || undefined}
      emptyText={t("no_filter_matches")}
    />
  );
}
