"use client";

import { itemNoteSchema, TEXT_MAX_LENGTH, type Item, type UpdateItemInput } from "@revivenotes/shared";
import { useForm } from "react-hook-form";

const fieldClass =
  "w-full rounded border border-neutral-300 px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const buttonClass =
  "rounded bg-neutral-900 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

type NoteFields = {
  note: string;
};

type ItemNoteFormProps = {
  item: Item;
  pending: boolean;
  onSave: (patch: UpdateItemInput) => void;
  onInvalid: (message: string | null) => void;
};

export default function ItemNoteForm({ item, pending, onSave, onInvalid }: ItemNoteFormProps) {
  const form = useForm<NoteFields>({
    defaultValues: { note: item.note ?? "" },
  });

  function onSubmit(values: NoteFields) {
    const parsed = itemNoteSchema.safeParse(values.note);
    if (!parsed.success) {
      onInvalid(parsed.error.issues[0]?.message ?? "راجع البيانات");
      return;
    }
    if (parsed.data === item.note) {
      onInvalid(null);
      return;
    }
    onSave({ note: parsed.data });
  }

  return (
    <form className="flex flex-col gap-3" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="item-note">
          ملاحظة (اختياري)
        </label>
        <textarea
          id="item-note"
          rows={4}
          maxLength={TEXT_MAX_LENGTH}
          className={fieldClass}
          {...form.register("note")}
        />
      </div>
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "بنحفظ..." : "حفظ"}
      </button>
    </form>
  );
}
