"use client";

import type { Category } from "@revivenotes/shared";
import { useQuery } from "@tanstack/react-query";
import { api, apiError } from "@/lib/api";
import { alertClass, fieldClass, labelClass, mutedClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

type CaptureCategoryFieldProps = {
  value: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
};

export default function CaptureCategoryField({ value, onChange, disabled }: CaptureCategoryFieldProps) {
  const { t } = useT();
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
      <label className={labelClass} htmlFor="capture-category">
        {t("category_optional")}
      </label>
      {categories.isPending ? <p className={mutedClass}>{t("loading_categories")}</p> : null}
      {categories.isError ? (
        <p className={alertClass} role="alert">
          {categories.error instanceof Error ? categories.error.message : t("generic_error")}
        </p>
      ) : null}
      {categories.data ? (
        <select
          id="capture-category"
          className={fieldClass}
          disabled={disabled}
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        >
          <option value="">{t("no_category")}</option>
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
