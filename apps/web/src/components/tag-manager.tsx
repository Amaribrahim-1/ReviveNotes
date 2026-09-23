"use client";

import { tagSchema, type Tag, type TagInput } from "@revivenotes/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { translateIssue, useT } from "@/lib/use-t";
import {
  alertClass,
  buttonClass,
  buttonSecondaryClass,
  fieldClass,
  labelClass,
  mutedClass,
  surfacePanelClass,
} from "@/lib/ui-classes";

export function TagManager() {
  const { t, locale } = useT();
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
      const message = translateIssue(locale, parsed.error.issues[0]?.message);
      setFormError(message);
      toast.error(message);
      return;
    }

    const toastId = toast.loading(t("adding"));
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
      setFormError(t("offline"));
      toast.error(t("offline"), { id: toastId });
      return;
    }

    form.reset({ name: "" });
    await refresh();
    toast.success(t("tag_added"), { id: toastId });
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
      const message = translateIssue(locale, parsed.error.issues[0]?.message);
      setFormError(message);
      toast.error(message);
      return;
    }

    const toastId = toast.loading(t("saving"));
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
      setFormError(t("offline"));
      toast.error(t("offline"), { id: toastId });
      return;
    }

    setEditingId(null);
    await refresh();
    toast.success(t("tag_saved"), { id: toastId });
  }

  async function onDelete(id: string) {
    setDeleting(true);
    setFormError(null);
    const toastId = toast.loading(t("deleting"));
    try {
      const response = await api(`/tags/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const message = await apiError(response);
        setFormError(message);
        toast.error(message, { id: toastId });
        return;
      }
    } catch {
      setFormError(t("offline"));
      toast.error(t("offline"), { id: toastId });
      return;
    } finally {
      setDeleting(false);
    }

    if (editingId === id) {
      setEditingId(null);
    }
    setConfirmId(null);
    await refresh();
    toast.success(t("tag_deleted"), { id: toastId });
  }

  return (
    <section className={`${surfacePanelClass} flex flex-col gap-4`}>
      <h2 className="text-xl font-semibold tracking-tight">{t("tags")}</h2>
      <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onCreate)}>
        <div>
          <label className={labelClass} htmlFor="new-tag-name">
            {t("name")}
          </label>
          <input id="new-tag-name" type="text" autoComplete="off" className={fieldClass} {...form.register("name")} />
        </div>
        <button type="submit" disabled={form.formState.isSubmitting} className={buttonClass}>
          {form.formState.isSubmitting ? t("adding") : t("add_tag")}
        </button>
      </form>

      {formError ? (
        <p className={alertClass} role="alert">
          {formError}
        </p>
      ) : null}

      {tags.isPending ? <p className={mutedClass}>{t("loading_tags")}</p> : null}
      {tags.isError ? <p role="alert">{tags.error.message}</p> : null}
      {tags.data && tags.data.length === 0 ? <p className={mutedClass}>{t("no_tags_yet")}</p> : null}

      {tags.data && tags.data.length > 0 ? (
        <ul className="flex flex-col gap-3">
          {tags.data.map((tag) => (
            <li key={tag.id} className="flex flex-col gap-3 rounded-xl border border-rn-border bg-rn-surface p-3">
              {editingId === tag.id ? (
                <form className="flex flex-col gap-3" noValidate onSubmit={editForm.handleSubmit(onRename)}>
                  <div>
                    <label className={labelClass} htmlFor="edit-tag-name">
                      {t("name")}
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
                      {editForm.formState.isSubmitting ? t("saving") : t("save")}
                    </button>
                    <button type="button" onClick={() => setEditingId(null)} className={buttonSecondaryClass}>
                      {t("cancel")}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  <p>{tag.name}</p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => startEdit(tag)} className={buttonSecondaryClass}>
                      {t("edit")}
                    </button>
                    {confirmId === tag.id ? null : (
                      <button type="button" onClick={() => setConfirmId(tag.id)} className={buttonSecondaryClass}>
                        {t("delete")}
                      </button>
                    )}
                  </div>
                  {confirmId === tag.id ? (
                    <div className="flex flex-col gap-2">
                      <p>{t("delete_tag_confirm")}</p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => onDelete(tag.id)}
                          disabled={deleting}
                          className={buttonClass}
                        >
                          {deleting ? t("deleting") : t("confirm_delete")}
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} className={buttonSecondaryClass}>
                          {t("cancel")}
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
