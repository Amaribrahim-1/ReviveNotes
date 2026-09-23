import { ITEM_STATUSES, type Item, type ItemStatus, type UpdateItemInput } from "@revivenotes/shared";
import {
  labelClass,
  segmentBaseClass,
  segmentIdleClass,
  segmentSelectedClass,
} from "@/lib/ui-classes";

const statusLabel: Record<ItemStatus, string> = {
  inbox: "الوارد",
  active: "هشتغل عليها",
  done: "خلصت",
  archived: "أرشيف",
};

type ItemStatusControlsProps = {
  item: Item;
  pending: boolean;
  onSave: (patch: UpdateItemInput) => void;
};

export default function ItemStatusControls({ item, pending, onSave }: ItemStatusControlsProps) {
  return (
    <div>
      <p className={labelClass} id="item-status-label">
        الحالة
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
              {statusLabel[status]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
