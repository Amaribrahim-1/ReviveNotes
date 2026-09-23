"use client";

import { createItemSchema, LINK_MAX_LENGTH, TEXT_MAX_LENGTH } from "@revivenotes/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import ImageCapture from "./ImageCapture";
import VoiceCapture from "./VoiceCapture";

const fieldClass =
  "w-full rounded border border-neutral-300 px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const buttonClass =
  "rounded bg-neutral-900 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

const captureTypes = [
  { id: "text", label: "نص" },
  { id: "link", label: "رابط" },
  { id: "voice", label: "صوت" },
  { id: "image", label: "صورة" },
] as const;

type CaptureType = (typeof captureTypes)[number]["id"];

type CaptureFields = {
  content: string;
  note: string;
};

export default function CaptureForm() {
  const queryClient = useQueryClient();
  const form = useForm<CaptureFields>({
    defaultValues: { content: "", note: "" },
  });
  const [selectedType, setSelectedType] = useState<CaptureType>("text");
  const [error, setError] = useState<string | null>(null);

  function chooseType(next: CaptureType) {
    setSelectedType(next);
    setError(null);
    form.reset();
  }

  async function onSubmit(values: CaptureFields) {
    if (selectedType === "voice" || selectedType === "image") {
      return;
    }
    setError(null);
    const parsed = createItemSchema.safeParse(
      selectedType === "link"
        ? {
            type: "link",
            content: values.content,
            ...(values.note.trim() === "" ? {} : { note: values.note }),
          }
        : { type: selectedType, content: values.content },
    );
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "راجع البيانات";
      setError(message);
      toast.error(message);
      return;
    }

    const toastId = toast.loading("بنحفظ...");
    try {
      const response = await api("/items", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        const message = await apiError(response);
        setError(message);
        toast.error(message, { id: toastId });
        return;
      }
    } catch {
      setError("مش قادرين نوصل للسيرفر");
      toast.error("مش قادرين نوصل للسيرفر", { id: toastId });
      return;
    }

    form.reset();
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    toast.success("اتحفظت", { id: toastId });
  }

  let field: ReactNode;
  switch (selectedType) {
    case "text":
      field = (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="capture-text">
            الملاحظة
          </label>
          <textarea
            id="capture-text"
            rows={4}
            maxLength={TEXT_MAX_LENGTH}
            className={fieldClass}
            {...form.register("content")}
          />
        </div>
      );
      break;
    case "link":
      field = (
        <>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="capture-link">
              الرابط
            </label>
            <input
              id="capture-link"
              type="url"
              maxLength={LINK_MAX_LENGTH}
              autoComplete="off"
              dir="ltr"
              className={fieldClass}
              {...form.register("content")}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="capture-link-note">
              ملاحظة (اختياري)
            </label>
            <textarea
              id="capture-link-note"
              rows={3}
              maxLength={TEXT_MAX_LENGTH}
              className={fieldClass}
              {...form.register("note")}
            />
          </div>
        </>
      );
      break;
    case "voice":
    case "image":
      field = null;
      break;
  }

  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <div role="radiogroup" aria-label="النوع" className="flex gap-2">
        {captureTypes.map((captureType) => {
          const selected = selectedType === captureType.id;
          return (
            <button
              key={captureType.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => chooseType(captureType.id)}
              className={`rounded px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 ${selected ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}
            >
              {captureType.label}
            </button>
          );
        })}
      </div>
      {selectedType === "voice" ? (
        <VoiceCapture />
      ) : selectedType === "image" ? (
        <ImageCapture />
      ) : (
        <>
          <div key={selectedType}>{field}</div>
          {error ? (
            <p className="text-red-700" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={form.formState.isSubmitting} className={buttonClass}>
            {form.formState.isSubmitting ? "بنحفظ..." : "حفظ"}
          </button>
        </>
      )}
    </form>
  );
}
