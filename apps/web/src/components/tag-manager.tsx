"use client";

import { tagSchema, type Tag, type TagInput } from "@revivenotes/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";

const fieldClass =
  "w-full rounded border border-neutral-300 px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const buttonClass =
  "rounded bg-neutral-900 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";
const quietButtonClass =
  "rounded border border-neutral-300 px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

export function TagManager() {
  const queryClient = useQueryClient();
  const form = useForm<TagInput>({
    defaultValues: { name: "" },
  });
  const editForm = useForm<TagInput>({
    defaultValues: { name: "" },
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["tags"] });
  }

  async function onCreate(values: TagInput) {
    setFormError(null);
    const parsed = tagSchema.safeParse(values);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "راجع البيانات";
      setFormError(message);
      toast.error(message);
      return;
    }

    const toastId = toast.loading("بنضيف...");
    try {
      const response = await api("/tags", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const message = await apiError(response);
        setFormError(message);
        toast.error(message, { id: toastId });
        return;
      }
    } catch {
      setFormError("مش قادرين نوصل للسيرفر");
      toast.error("مش قادرين نوصل للسيرفر", { id: toastId });
      return;
    }

    form.reset({ name: "" });
    await refresh();
    toast.success("اتضاف الوسم", { id: toastId });
  }

  function startEdit(tag: Tag) {
    setEditingId(tag.id);
    setConfirmId(null);
    setFormError(null);
    editForm.reset({ name: tag.name });
  }

  async function onRename(values: TagInput) {
    if (!editingId) {
      return;
    }
    setFormError(null);
    const parsed = tagSchema.safeParse(values);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "راجع البيانات";
      setFormError(message);
      toast.error(message);
      return;
    }

    const toastId = toast.loading("بنحفظ...");
    try {
      const response = await api(`/tags/${editingId}`, {
        method: "PATCH",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const message = await apiError(response);
        setFormError(message);
        toast.error(message, { id: toastId });
        return;
      }
    } catch {
      setFormError("مش قادرين نوصل للسيرفر");
      toast.error("مش قادرين نوصل للسيرفر", { id: toastId });
      return;
    }

    setEditingId(null);
    await refresh();
    toast.success("اتحفظ الوسم", { id: toastId });
  }

  async function onDelete(id: string) {
    setDeleting(true);
    setFormError(null);
    const toastId = toast.loading("بنحذف...");
    try {
      const response = await api(`/tags/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const message = await apiError(response);
        setFormError(message);
        toast.error(message, { id: toastId });
        return;
      }
    } catch {
      setFormError("مش قادرين نوصل للسيرفر");
      toast.error("مش قادرين نوصل للسيرفر", { id: toastId });
      return;
    } finally {
      setDeleting(false);
    }

    if (editingId === id) {
      setEditingId(null);
    }
    setConfirmId(null);
    await refresh();
    toast.success("اتحذف الوسم", { id: toastId });
  }

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">الوسوم</h2>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onCreate)}>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="new-tag-name">
            الاسم
          </label>
          <input id="new-tag-name" type="text" autoComplete="off" className={fieldClass} {...form.register("name")} />
        </div>
        <button type="submit" disabled={form.formState.isSubmitting} className={buttonClass}>
          {form.formState.isSubmitting ? "بنضيف..." : "إضافة وسم"}
        </button>
      </form>

      {formError ? (
        <p className="text-red-700" role="alert">
          {formError}
        </p>
      ) : null}

      {tags.isPending ? <p>بنحمّل الوسوم...</p> : null}
      {tags.isError ? <p role="alert">{tags.error.message}</p> : null}
      {tags.data && tags.data.length === 0 ? <p>لسه مفيش وسوم.</p> : null}

      {tags.data && tags.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {tags.data.map((tag) => (
            <li key={tag.id} className="flex flex-col gap-3 rounded border border-neutral-300 p-3">
              {editingId === tag.id ? (
                <form className="flex flex-col gap-3" noValidate onSubmit={editForm.handleSubmit(onRename)}>
                  <div>
                    <label className="mb-1 block text-sm font-medium" htmlFor="edit-tag-name">
                      الاسم
                    </label>
                    <input
                      id="edit-tag-name"
                      type="text"
                      autoComplete="off"
                      className={fieldClass}
                      {...editForm.register("name")}
                    />
                  </div>
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
                  <p>{tag.name}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEdit(tag)} className={quietButtonClass}>
                      تعديل
                    </button>
                    {confirmId === tag.id ? null : (
                      <button type="button" onClick={() => setConfirmId(tag.id)} className={quietButtonClass}>
                        حذف
                      </button>
                    )}
                  </div>
                  {confirmId === tag.id ? (
                    <div className="flex flex-col gap-2">
                      <p>حذف الوسم ده؟ العناصر هتفضل.</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onDelete(tag.id)}
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
          ))}
        </ul>
      ) : null}
    </section>
  );
}
