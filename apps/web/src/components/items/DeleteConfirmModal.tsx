"use client";

import { useEffect, useRef } from "react";
import { buttonDangerClass, buttonSecondaryClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

type DeleteConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
};

export default function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  pending,
}: DeleteConfirmModalProps) {
  const { t } = useT();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      if (!pending) {
        onClose();
      }
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => {
      dialog.removeEventListener("cancel", handleCancel);
    };
  }, [onClose, pending]);

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-black/50 open:flex flex-col gap-4 rounded-md bg-rn-card text-rn-text p-6 shadow-xl w-full max-w-sm border border-rn-border m-auto"
    >
      <p>{t("delete_forever_warn")}</p>
      <div className="flex flex-wrap gap-2 mt-2">
        <button
          type="button"
          className={buttonDangerClass}
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? t("deleting") : t("confirm_delete")}
        </button>
        <button
          type="button"
          className={buttonSecondaryClass}
          disabled={pending}
          onClick={onClose}
        >
          {t("cancel")}
        </button>
      </div>
    </dialog>
  );
}
