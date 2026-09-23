"use client";

import { itemNoteSchema, TEXT_MAX_LENGTH, type Item, type UpdateItemInput } from "@revivenotes/shared";
import { useForm } from "react-hook-form";
import { buttonClass, fieldClass, labelClass } from "@/lib/ui-classes";

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
        <label className={labelClass} htmlFor="item-note">
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
