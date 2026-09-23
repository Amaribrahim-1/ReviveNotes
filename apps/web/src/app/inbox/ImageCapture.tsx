"use client";

import { IMAGE_CONTENT_TYPES, IMAGE_MAX_BYTES, imageContentTypeSchema, TEXT_MAX_LENGTH } from "@revivenotes/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { alertClass, buttonClass, fieldClass, labelClass, mutedClass } from "@/lib/ui-classes";
import { translateIssue, useT } from "@/lib/use-t";

export default function ImageCapture() {
  const { t, locale } = useT();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    setError(null);
    if (!file) {
      const message = t("pick_image");
      setError(message);
      toast.error(message);
      return;
    }
    if (file.size === 0) {
      const message = t("image_empty");
      setError(message);
      toast.error(message);
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      const message = t("image_too_big");
      setError(message);
      toast.error(message);
      return;
    }
    if (file.type) {
      const base = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
      const parsed = imageContentTypeSchema.safeParse(base);
      if (!parsed.success) {
        const message = translateIssue(locale, parsed.error.issues[0]?.message, "image_type");
        setError(message);
        toast.error(message);
        return;
      }
    }

    const form = new FormData();
    form.append("image", file);
    if (note.trim() !== "") {
      form.append("note", note);
    }
    setUploading(true);
    const toastId = toast.loading(t("saving"));
    try {
      const response = await api("/items/image", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        const message = await apiError(response);
        setError(message);
        toast.error(message, { id: toastId });
        return;
      }
    } catch {
      setError(t("offline"));
      toast.error(t("offline"), { id: toastId });
      return;
    } finally {
      setUploading(false);
    }

    setFile(null);
    setNote("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    toast.success(t("saved"), { id: toastId });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className={labelClass} htmlFor="capture-image">
          {t("type_image")}
        </label>
        <input
          ref={inputRef}
          id="capture-image"
          type="file"
          accept={IMAGE_CONTENT_TYPES.join(",")}
          disabled={uploading}
          className={fieldClass}
          onChange={(event) => {
            setError(null);
            setFile(event.target.files?.[0] ?? null);
          }}
        />
      </div>
      {file ? (
        <p className={`break-all text-sm ${mutedClass}`} dir="ltr">
          {file.name}
        </p>
      ) : null}
      <div>
        <label className={labelClass} htmlFor="capture-image-note">
          {t("note_optional")}
        </label>
        <textarea
          id="capture-image-note"
          rows={3}
          maxLength={TEXT_MAX_LENGTH}
          disabled={uploading}
          className={fieldClass}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      {error ? (
        <p className={alertClass} role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={uploading}
        onClick={() => {
          void upload();
        }}
        className={buttonClass}
      >
        {uploading ? t("saving") : t("save")}
      </button>
    </div>
  );
}
