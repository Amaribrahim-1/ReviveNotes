"use client";

import ItemList from "@/components/items/ItemList";
import { useItemFilters } from "./use-item-filters";

export default function AllItemsList() {
  const categoryId = useItemFilters((state) => state.categoryId);
  const status = useItemFilters((state) => state.status);
  const type = useItemFilters((state) => state.type);
  const tagIds = useItemFilters((state) => state.tagIds);

  return (
    <ItemList
      categoryId={categoryId || undefined}
      status={status || undefined}
      type={type || undefined}
      tagIds={tagIds}
      emptyText="مفيش ملاحظات بالفلاتر دي."
    />
  );
}
