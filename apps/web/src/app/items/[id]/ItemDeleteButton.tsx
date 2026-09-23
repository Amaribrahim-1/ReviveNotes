import { useState } from "react";
import { buttonDangerClass, buttonSecondaryClass } from "@/lib/ui-classes";
import { translateIssue, useT } from "@/lib/use-t";

type ItemDeleteButtonProps = {
  pending: boolean;
  onDelete: () => void;
};

export default function ItemDeleteButton({ pending, onDelete }: ItemDeleteButtonProps) {
  const { t, locale } = useT();
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
          {t("delete_forever")}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 border-t border-rn-border pt-4">
      <p>{t("delete_forever_warn")}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonDangerClass} disabled={pending} onClick={onDelete}>
          {pending ? t("deleting") : t("confirm_delete")}
        </button>
        <button
          type="button"
          className={buttonSecondaryClass}
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          {t("cancel")}
        </button>
      </div>
    </div>
  );
}
