import { useState } from "react";

const quietButtonClass =
  "rounded border border-neutral-300 px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";
const dangerButtonClass =
  "rounded border border-red-700 px-4 py-2 text-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60";

type ItemDeleteButtonProps = {
  pending: boolean;
  onDelete: () => void;
};

export default function ItemDeleteButton({ pending, onDelete }: ItemDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="border-t border-neutral-200 pt-4">
        <button type="button" className={dangerButtonClass} disabled={pending} onClick={() => setConfirming(true)}>
          حذف نهائي
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-neutral-200 pt-4">
      <p>الحذف نهائي والملاحظة مش هترجع.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={dangerButtonClass} disabled={pending} onClick={onDelete}>
          {pending ? "بنحذف..." : "تأكيد الحذف"}
        </button>
        <button type="button" className={quietButtonClass} disabled={pending} onClick={() => setConfirming(false)}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
