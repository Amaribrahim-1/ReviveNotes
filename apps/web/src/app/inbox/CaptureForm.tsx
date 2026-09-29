"use client";

import { createItemSchema, LINK_MAX_LENGTH, TEXT_MAX_LENGTH } from "@revivenotes/shared";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import {
  alertClass,
  buttonClass,
  fieldClass,
  labelClass,
  segmentIdleClass,
  segmentSelectedClass,
  surfacePanelClass,
} from "@/lib/ui-classes";
import CaptureCategoryField from "./CaptureCategoryField";
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

export default function CaptureForm() {
  const { t, locale } = useT();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<CaptureType>("text");
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [fieldsKey, setFieldsKey] = useState(0);

  function chooseType(next: CaptureType) {
    setSelectedType(next);
    setError(null);
    setFieldsKey((current) => current + 1);
  }

  function clearFields() {
    setCategoryId("");
    setFieldsKey((current) => current + 1);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedType === "voice" || selectedType === "image") {
      return;
    }
    setError(null);
    const data = new FormData(event.currentTarget);
    const content = String(data.get("content") ?? "");
    const note = String(data.get("note") ?? "");
    const parsed = createItemSchema.safeParse(
      selectedType === "link"
        ? {
            type: "link",
            content,
            ...(note.trim() === "" ? {} : { note }),
            ...(categoryId === "" ? {} : { category_id: categoryId }),
          }
        : {
            type: selectedType,
            content,
            ...(categoryId === "" ? {} : { category_id: categoryId }),
          },
    );
    if (!parsed.success) {
      const message = translateIssue(locale, parsed.error.issues[0]?.message);
      setError(message);
      toast.error(message);
      return;
    }

    setSaving(true);
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
    } finally {
      setSaving(false);
    }

    clearFields();
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
            name="content"
            rows={4}
            maxLength={TEXT_MAX_LENGTH}
            dir="auto"
            className={fieldClass}
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
              name="content"
              type="text"
              inputMode="url"
              maxLength={LINK_MAX_LENGTH}
              autoComplete="off"
              dir="ltr"
              className={fieldClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="capture-link-note">
              {t("note_optional")}
            </label>
            <textarea
              id="capture-link-note"
              name="note"
              rows={3}
              maxLength={TEXT_MAX_LENGTH}
              dir="auto"
              className={fieldClass}
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
    <form className={`${surfacePanelClass} flex flex-col gap-4`} noValidate onSubmit={onSubmit}>
      <div role="radiogroup" aria-label={t("type_label")} className="grid grid-cols-4 gap-1 sm:gap-2">
        {captureTypes.map((captureType) => {
          const selected = selectedType === captureType.id;
          return (
            <button
              key={captureType.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => chooseType(captureType.id)}
              className={`min-w-0 w-full rounded-xl px-1 py-2 text-center text-sm whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rn-accent sm:px-4 sm:text-base ${selected ? segmentSelectedClass : segmentIdleClass}`}
            >
              {t(captureType.label)}
            </button>
          );
        })}
      </div>
      <CaptureCategoryField value={categoryId} onChange={setCategoryId} />
      {selectedType === "voice" ? (
        <VoiceCapture categoryId={categoryId} onSaved={clearFields} />
      ) : selectedType === "image" ? (
        <ImageCapture categoryId={categoryId} onSaved={clearFields} />
      ) : (
        <>
          <div key={fieldsKey}>{field}</div>
          {error ? (
            <p className={alertClass} role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" disabled={saving} className={buttonClass}>
            {saving ? t("saving") : t("save")}
          </button>
        </>
      )}
    </form>
  );
}
