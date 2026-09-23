import { ITEM_STATUSES, type Item, type ItemStatus, type UpdateItemInput } from "@revivenotes/shared";
import {
  labelClass,
  segmentBaseClass,
  segmentIdleClass,
  segmentSelectedClass,
} from "@/lib/ui-classes";
import type { UiKey } from "@/lib/ui-copy";
import { useT } from "@/lib/use-t";

const statusKey: Record<ItemStatus, UiKey> = {
  inbox: "status_inbox",
  active: "status_active",
  done: "status_done",
  archived: "status_archived",
};

type ItemStatusControlsProps = {
  item: Item;
  pending: boolean;
  onSave: (patch: UpdateItemInput) => void;
};

export default function ItemStatusControls({ item, pending, onSave }: ItemStatusControlsProps) {
  const { t } = useT();

  return (
    <div>
      <p className={labelClass} id="item-status-label">
        {t("status_label")}
      </p>
      <div role="group" aria-labelledby="item-status-label" className="flex flex-wrap gap-2">
        {ITEM_STATUSES.map((status) => {
          const selected = item.status === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={selected}
              disabled={pending}
              onClick={() => {
                if (selected) {
                  return;
                }
                onSave({ status });
              }}
              className={`${segmentBaseClass} ${selected ? segmentSelectedClass : segmentIdleClass}`}
            >
              {t(statusKey[status])}
            </button>
          );
        })}
      </div>
    </div>
  );
}
