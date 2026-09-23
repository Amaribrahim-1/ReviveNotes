import type { Item, Tag, UpdateItemInput } from "@revivenotes/shared";
import { useQuery } from "@tanstack/react-query";
import { api, apiError } from "@/lib/api";
import { alertClass, labelClass, mutedClass } from "@/lib/ui-classes";
import { translateIssue, useT } from "@/lib/use-t";

type ItemTagFieldProps = {
  item: Item;
  pending: boolean;
  onSave: (patch: UpdateItemInput) => void;
};

export default function ItemTagField({ item, pending, onSave }: ItemTagFieldProps) {
  const { t, locale } = useT();
  const tags = useQuery({
    queryKey: ["tags"],
    retry: false,
    queryFn: async (): Promise<Tag[]> => {
      const response = await api("/tags");
      if (!response.ok) {
        throw new Error(await apiError(response));
      }
      return response.json() as Promise<Tag[]>;
    },
  });

  function toggle(tagId: string) {
    const selected = item.tag_ids.includes(tagId);
    const next = selected ? item.tag_ids.filter((id) => id !== tagId) : [...item.tag_ids, tagId];
    onSave({ tag_ids: next });
  }

  return (
    <fieldset className="flex flex-col gap-1" disabled={pending}>
      <legend className={labelClass}>{t("tag_legend")}</legend>
      {tags.isPending ? <p className={mutedClass}>{t("loading_tags")}</p> : null}
      {tags.isError ? (
        <p className={alertClass} role="alert">
          {tags.error instanceof Error ? tags.error.message : t("generic_error")}
        </p>
      ) : null}
      {tags.data && tags.data.length === 0 ? <p className={mutedClass}>{t("no_tags_yet")}</p> : null}
      {tags.data?.map((tag) => (
        <label key={tag.id} className="flex items-center gap-2 py-1">
          <input
            type="checkbox"
            checked={item.tag_ids.includes(tag.id)}
            onChange={() => toggle(tag.id)}
            className="h-4 w-4"
          />
          <span>{tag.name}</span>
        </label>
      ))}
    </fieldset>
  );
}
