import { useState } from "react";
import { buttonDangerClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";
import DeleteConfirmModal from "@/components/items/DeleteConfirmModal";

type ItemDeleteButtonProps = {
  pending: boolean;
  onDelete: () => void;
};

export default function ItemDeleteButton({ pending, onDelete }: ItemDeleteButtonProps) {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-t border-rn-border pt-4">
      <button
        type="button"
        className={buttonDangerClass}
        disabled={pending}
        onClick={() => setIsOpen(true)}
      >
        {t("delete_forever")}
      </button>

      <DeleteConfirmModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={onDelete}
        pending={pending}
      />
    </div>
  );
}
