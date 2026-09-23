"use client";

import { IMAGE_CONTENT_TYPES, IMAGE_MAX_BYTES, imageContentTypeSchema } from "@revivenotes/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { api, apiError } from "@/lib/api";

const fieldClass =
  "w-full rounded border border-neutral-300 px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const buttonClass =
  "rounded bg-neutral-900 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

export default function ImageCapture() {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload() {
    setError(null);
    if (!file) {
      setError("اختار صورة");
      return;
    }
    if (file.size === 0) {
      setError("الصورة فاضية");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      setError("الصورة أكبر من 5 ميجا");
      return;
    }
    if (file.type) {
      const base = file.type.split(";")[0]?.trim().toLowerCase() ?? "";
      const parsed = imageContentTypeSchema.safeParse(base);
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "نوع الصورة لازم يكون jpeg أو png أو webp أو gif");
        return;
      }
    }

    const form = new FormData();
    form.append("image", file);
    setUploading(true);
    try {
      const response = await api("/items/image", {
        method: "POST",
        body: form,
      });
      if (!response.ok) {
        setError(await apiError(response));
        return;
      }
    } catch {
      setError("مش قادرين نوصل للسيرفر");
      return;
    } finally {
      setUploading(false);
    }

    setFile(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
    await queryClient.invalidateQueries({ queryKey: ["items"] });
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="capture-image">
          الصورة
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
        <p className="break-all text-sm" dir="ltr">
          {file.name}
        </p>
      ) : null}
      {error ? (
        <p className="text-red-700" role="alert">
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
        {uploading ? "بنحفظ..." : "حفظ"}
      </button>
    </div>
  );
}
