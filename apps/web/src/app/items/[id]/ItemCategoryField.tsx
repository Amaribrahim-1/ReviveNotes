import type { Category, Item, UpdateItemInput } from "@revivenotes/shared";
import { useQuery } from "@tanstack/react-query";
import { api, apiError } from "@/lib/api";
import { alertClass, fieldClass, labelClass, mutedClass } from "@/lib/ui-classes";

type ItemCategoryFieldProps = {
  item: Item;
  pending: boolean;
  onSave: (patch: UpdateItemInput) => void;
};

export default function ItemCategoryField({ item, pending, onSave }: ItemCategoryFieldProps) {
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

  return (
    <div>
      <label className={labelClass} htmlFor="item-category">
        التصنيف
      </label>
      {categories.isPending ? <p className={mutedClass}>بنحمّل التصنيفات...</p> : null}
      {categories.isError ? (
        <p className={alertClass} role="alert">
          {categories.error instanceof Error ? categories.error.message : "حصل خطأ. حاول تاني."}
        </p>
      ) : null}
      {categories.data ? (
        <select
          id="item-category"
          className={fieldClass}
          disabled={pending}
          value={item.category_id ?? ""}
          onChange={(event) => {
            const next = event.target.value === "" ? null : event.target.value;
            if (next === item.category_id) {
              return;
            }
            onSave({ category_id: next });
          }}
        >
          <option value="">من غير تصنيف</option>
          {categories.data.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
