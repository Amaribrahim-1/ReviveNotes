"use client";

import { createItemSchema, LINK_MAX_LENGTH, TEXT_MAX_LENGTH } from "@revivenotes/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { api, apiError } from "@/lib/api";
import VoiceCapture from "./VoiceCapture";

const fieldClass =
  "w-full rounded border border-neutral-300 px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const buttonClass =
  "rounded bg-neutral-900 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

const captureTypes = [
  { id: "text", label: "نص" },
  { id: "link", label: "رابط" },
  { id: "voice", label: "صوت" },
] as const;

type CaptureType = (typeof captureTypes)[number]["id"];

type CaptureFields = {
  content: string;
};

export default function CaptureForm() {
  const queryClient = useQueryClient();
  const form = useForm<CaptureFields>({
    defaultValues: { content: "" },
  });
  const [selectedType, setSelectedType] = useState<CaptureType>("text");
  const [error, setError] = useState<string | null>(null);

  function chooseType(next: CaptureType) {
    setSelectedType(next);
    setError(null);
    form.reset();
  }

  async function onSubmit(values: CaptureFields) {
    if (selectedType === "voice") {
      return;
    }
    setError(null);
    const parsed = createItemSchema.safeParse({
      type: selectedType,
      content: values.content,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "راجع البيانات");
      return;
    }

    try {
      const response = await api("/items", {
        method: "POST",
        body: JSON.stringify(parsed.data),
      });
      if (!response.ok) {
        setError(await apiError(response));
        return;
      }
    } catch {
      setError("مش قادرين نوصل للسيرفر");
      return;
    }

    form.reset();
    await queryClient.invalidateQueries({ queryKey: ["items"] });
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
      );
      break;
    case "voice":
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
