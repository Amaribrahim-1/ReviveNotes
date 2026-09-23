import { useState } from "react";
import { buttonDangerClass, buttonSecondaryClass } from "@/lib/ui-classes";

type ItemDeleteButtonProps = {
  pending: boolean;
  onDelete: () => void;
};

export default function ItemDeleteButton({ pending, onDelete }: ItemDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="border-t border-rn-border pt-4">
        <button
          type="button"
          className={buttonDangerClass}
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          حذف نهائي
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-rn-border pt-4">
      <p>الحذف نهائي والملاحظة مش هترجع.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonDangerClass} disabled={pending} onClick={onDelete}>
          {pending ? "بنحذف..." : "تأكيد الحذف"}
        </button>
        <button
          type="button"
          className={buttonSecondaryClass}
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          إلغاء
        </button>
      </div>
    </div>
  );
}
