"use client";

import {
  CATEGORY_COLORS,
  categorySchema,
  type Category,
  type CategoryColor,
  type CategoryInput,
} from "@revivenotes/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { api, apiError } from "@/lib/api";
import { categoryColorClass, categoryColorLabel, knownCategoryColor } from "@/lib/category-colors";

const fieldClass =
  "w-full rounded border border-neutral-300 px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const buttonClass =
  "rounded bg-neutral-900 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";
const quietButtonClass =
  "rounded border border-neutral-300 px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

type ColorSwatchesProps = {
  idPrefix: string;
  value: CategoryColor;
  onChange: (color: CategoryColor) => void;
};

function ColorSwatches({ idPrefix, value, onChange }: ColorSwatchesProps) {
  const labelId = `${idPrefix}-color-label`;

  return (
    <div>
      <p className="mb-2 text-sm font-medium" id={labelId}>
        اللون
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {CATEGORY_COLORS.map((color) => {
          const selected = value === color;
          return (
            <button
              key={color}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={categoryColorLabel[color]}
              onClick={() => onChange(color)}
              className={`h-11 w-11 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${categoryColorClass[color]} ${selected ? "ring-2 ring-neutral-900 ring-offset-2" : ""}`}
            />
          );
        })}
      </div>
      <p className="mt-2 text-sm">{categoryColorLabel[value]}</p>
    </div>
  );
}

export function CategoryManager() {
  const queryClient = useQueryClient();
  const form = useForm<CategoryInput>({
    defaultValues: { name: "", color: "blue" },
  });
  const editForm = useForm<CategoryInput>({
    defaultValues: { name: "", color: "blue" },
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const selectedColor = form.watch("color");
  const editColor = editForm.watch("color");

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

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["categories"] });
  }

  async function onCreate(values: CategoryInput) {
    setFormError(null);
    const parsed = categorySchema.safeParse(values);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "راجع البيانات");
      return;
    }

    try {
      const response = await api("/categories", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setFormError(await apiError(response));
        return;
      }
    } catch {
      setFormError("مش قادرين نوصل للسيرفر");
      return;
    }

    form.reset({ name: "", color: "blue" });
    await refresh();
  }

  function startEdit(category: Category) {
    const color = knownCategoryColor(category.color) ?? "blue";
    setEditingId(category.id);
    setConfirmId(null);
    setFormError(null);
    editForm.reset({ name: category.name, color });
  }

  async function onRename(values: CategoryInput) {
    if (!editingId) {
      return;
    }
    setFormError(null);
    const parsed = categorySchema.safeParse(values);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "راجع البيانات");
      return;
    }

    try {
      const response = await api(`/categories/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setFormError(await apiError(response));
        return;
      }
    } catch {
      setFormError("مش قادرين نوصل للسيرفر");
      return;
    }

    setEditingId(null);
    await refresh();
  }

  async function onDelete(id: string) {
    setDeleting(true);
    setFormError(null);
    try {
      const response = await api(`/categories/${id}`, { method: "DELETE" });
      if (!response.ok) {
        setFormError(await apiError(response));
        return;
      }
    } catch {
      setFormError("مش قادرين نوصل للسيرفر");
      return;
    } finally {
      setDeleting(false);
    }

    if (editingId === id) {
      setEditingId(null);
    }
    setConfirmId(null);
    await refresh();
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">التصنيفات</h2>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onCreate)}>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="new-category-name">
            الاسم
          </label>
          <input
            id="new-category-name"
            type="text"
            autoComplete="off"
            className={fieldClass}
            {...form.register("name")}
          />
        </div>
        <ColorSwatches
          idPrefix="new-category"
          value={selectedColor}
          onChange={(color) => form.setValue("color", color)}
        />
        <button type="submit" disabled={form.formState.isSubmitting} className={buttonClass}>
          {form.formState.isSubmitting ? "بنضيف..." : "إضافة تصنيف"}
        </button>
      </form>

      {formError ? (
        <p className="text-red-700" role="alert">
          {formError}
        </p>
      ) : null}

      {categories.isPending ? <p>بنحمّل التصنيفات...</p> : null}
      {categories.isError ? <p role="alert">{categories.error.message}</p> : null}

      {categories.data && categories.data.length === 0 ? <p>لسه مفيش تصنيفات.</p> : null}

      {categories.data && categories.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {categories.data.map((category) => {
            const color = knownCategoryColor(category.color);
            return (
              <li key={category.id} className="flex flex-col gap-3 rounded border border-neutral-300 p-3">
                {editingId === category.id ? (
                  <form className="flex flex-col gap-3" noValidate onSubmit={editForm.handleSubmit(onRename)}>
                    <div>
                      <label className="mb-1 block text-sm font-medium" htmlFor="edit-category-name">
                        الاسم
                      </label>
                      <input
                        id="edit-category-name"
                        type="text"
                        autoComplete="off"
                        className={fieldClass}
                        {...editForm.register("name")}
                      />
                    </div>
                    <ColorSwatches
                      idPrefix="edit-category"
                      value={editColor}
                      onChange={(next) => editForm.setValue("color", next)}
                    />
                    <div className="flex gap-2">
                      <button type="submit" disabled={editForm.formState.isSubmitting} className={buttonClass}>
                        {editForm.formState.isSubmitting ? "بنحفظ..." : "حفظ"}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className={quietButtonClass}>
                        إلغاء
                      </button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block h-4 w-4 rounded-full ${color ? categoryColorClass[color] : "bg-neutral-300"}`}
                      />
                      <span>{category.name}</span>
                      {color ? <span className="text-sm text-neutral-600">{categoryColorLabel[color]}</span> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => startEdit(category)} className={quietButtonClass}>
                        تعديل
                      </button>
                      {confirmId === category.id ? null : (
                        <button type="button" onClick={() => setConfirmId(category.id)} className={quietButtonClass}>
                          حذف
                        </button>
                      )}
                    </div>
                    {confirmId === category.id ? (
                      <div className="flex flex-col gap-2">
                        <p>حذف التصنيف ده؟ العناصر هتفضل من غير تصنيف.</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => onDelete(category.id)}
                            disabled={deleting}
                            className={buttonClass}
                          >
                            {deleting ? "بنحذف..." : "تأكيد الحذف"}
                          </button>
                          <button type="button" onClick={() => setConfirmId(null)} className={quietButtonClass}>
                            إلغاء
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
