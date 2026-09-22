import {
  LINK_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  linkContentSchema,
  textContentSchema,
  type Item,
  type UpdateItemInput,
} from "@revivenotes/shared";
import { useForm } from "react-hook-form";

const fieldClass =
  "w-full rounded border border-neutral-300 px-3 py-2 outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const buttonClass =
  "rounded bg-neutral-900 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

type ContentFields = {
  content: string;
};

type ItemContentFormProps = {
  item: Item;
  pending: boolean;
  onSave: (patch: UpdateItemInput) => void;
  onInvalid: (message: string | null) => void;
};

export default function ItemContentForm({ item, pending, onSave, onInvalid }: ItemContentFormProps) {
  const form = useForm<ContentFields>({
    defaultValues: { content: item.content },
  });
  const isLink = item.type === "link";

  function onSubmit(values: ContentFields) {
    const parsed = isLink ? linkContentSchema.safeParse(values.content) : textContentSchema.safeParse(values.content);
    if (!parsed.success) {
      onInvalid(parsed.error.issues[0]?.message ?? "راجع البيانات");
      return;
    }
    if (parsed.data === item.content) {
      onInvalid(null);
      return;
    }
    onSave({ content: parsed.data });
  }

  return (
    <form className="flex flex-col gap-3" noValidate onSubmit={form.handleSubmit(onSubmit)}>
      {isLink ? (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="item-content">
            الرابط
          </label>
          <input
            id="item-content"
            type="url"
            maxLength={LINK_MAX_LENGTH}
            autoComplete="off"
            dir="ltr"
            className={fieldClass}
            {...form.register("content")}
          />
        </div>
      ) : (
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="item-content">
            الملاحظة
          </label>
          <textarea
            id="item-content"
            rows={4}
            maxLength={TEXT_MAX_LENGTH}
            className={fieldClass}
            {...form.register("content")}
          />
        </div>
      )}
      <button type="submit" disabled={pending} className={buttonClass}>
        حفظ
      </button>
    </form>
  );
}
