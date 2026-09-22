import { ITEM_STATUSES, type Item, type ItemStatus, type UpdateItemInput } from "@revivenotes/shared";

const statusLabel: Record<ItemStatus, string> = {
  inbox: "الوارد",
  active: "هشتغل عليها",
  done: "خلصت",
  archived: "أرشيف",
};

const buttonClass =
  "rounded px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

type ItemStatusControlsProps = {
  item: Item;
  pending: boolean;
  onSave: (patch: UpdateItemInput) => void;
};

export default function ItemStatusControls({ item, pending, onSave }: ItemStatusControlsProps) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium" id="item-status-label">
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
              className={`${buttonClass} ${selected ? "bg-neutral-900 text-white" : "border border-neutral-300"}`}
            >
              {statusLabel[status]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
