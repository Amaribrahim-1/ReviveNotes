"use client";

import { createItemSchema, LINK_MAX_LENGTH, TEXT_MAX_LENGTH } from "@revivenotes/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import {
  alertClass,
  buttonClass,
  fieldClass,
  labelClass,
  segmentBaseClass,
  segmentIdleClass,
  segmentSelectedClass,
  surfacePanelClass,
} from "@/lib/ui-classes";
import ImageCapture from "./ImageCapture";
import VoiceCapture from "./VoiceCapture";
import type { UiKey } from "@/lib/ui-copy";
import { translateIssue, useT } from "@/lib/use-t";

const captureTypes = [
  { id: "text", label: "type_text" },
  { id: "link", label: "type_link" },
  { id: "voice", label: "type_voice" },
  { id: "image", label: "type_image" },
] as const satisfies ReadonlyArray<{ id: string; label: UiKey }>;

type CaptureType = (typeof captureTypes)[number]["id"];

type CaptureFields = {
  content: string;
  note: string;
};

export default function CaptureForm() {
  const { t, locale } = useT();
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
      const message = translateIssue(locale, parsed.error.issues[0]?.message);
      setError(message);
      toast.error(message);
      return;
    }

    const toastId = toast.loading(t("saving"));
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
      setError(t("offline"));
      toast.error(t("offline"), { id: toastId });
      return;
    }

    form.reset();
    await queryClient.invalidateQueries({ queryKey: ["items"] });
    toast.success(t("saved"), { id: toastId });
  }

  let field: ReactNode;
  switch (selectedType) {
    case "text":
      field = (
        <div>
          <label className={labelClass} htmlFor="capture-text">
            {t("note")}
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
            <label className={labelClass} htmlFor="capture-link">
              {t("link")}
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
            <label className={labelClass} htmlFor="capture-link-note">
              {t("note_optional")}
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
    <form
      className={`${surfacePanelClass} flex flex-col gap-4`}
      noValidate
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div role="radiogroup" aria-label={t("type_label")} className="flex flex-wrap gap-2">
        {captureTypes.map((captureType) => {
          const selected = selectedType === captureType.id;
          return (
            <button
              key={captureType.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => chooseType(captureType.id)}
              className={`${segmentBaseClass} ${selected ? segmentSelectedClass : segmentIdleClass}`}
            >
              {t(captureType.label)}
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
            <p className={alertClass} role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={form.formState.isSubmitting} className={buttonClass}>
            {form.formState.isSubmitting ? t("saving") : t("save")}
          </button>
        </>
      )}
    </form>
  );
}
