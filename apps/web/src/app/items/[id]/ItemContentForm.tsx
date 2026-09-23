import {
  LINK_MAX_LENGTH,
  TEXT_MAX_LENGTH,
  linkContentSchema,
  textContentSchema,
  type Item,
  type UpdateItemInput,
} from "@revivenotes/shared";
import { useForm } from "react-hook-form";
import { buttonClass, fieldClass, labelClass } from "@/lib/ui-classes";
import { translateIssue, useT } from "@/lib/use-t";

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
  const { t, locale } = useT();
  const form = useForm<ContentFields>({
    defaultValues: { content: item.content },
  });
  const isLink = item.type === "link";

  function onSubmit(values: ContentFields) {
    const parsed = isLink ? linkContentSchema.safeParse(values.content) : textContentSchema.safeParse(values.content);
    if (!parsed.success) {
      onInvalid(translateIssue(locale, parsed.error.issues[0]?.message));
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
          <label className={labelClass} htmlFor="item-content">
            {t("link")}
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
          <label className={labelClass} htmlFor="item-content">
            {t("note")}
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
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
