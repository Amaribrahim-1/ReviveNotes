"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import HeaderToggles from "@/components/HeaderToggles";
import { readStoredLocale } from "@/lib/locale-storage";
import { saveSharedUrl, type SharedUrlResult } from "@/lib/pending-share";
import { alertClass, authPageClass, buttonClass, linkClass, mutedClass, titleClass } from "@/lib/ui-classes";
import { tUi } from "@/lib/ui-copy";
import { useT } from "@/lib/use-t";

type ShareView = "working" | "ignored" | "invalid" | "error";

async function openSharedLink(): Promise<SharedUrlResult> {
  const params = new URLSearchParams(window.location.search);
  return saveSharedUrl(params.get("url"));
}

export default function SharePage() {
  const { t } = useT();
  const [view, setView] = useState<ShareView>("working");

  useEffect(() => {
    void runShare(setView);
  }, []);

  return (
    <main className={authPageClass}>
      <div className="flex items-start justify-between gap-3">
        <h1 className={titleClass}>{t("share_title")}</h1>
        <HeaderToggles />
      </div>
      {view === "working" ? (
        <p aria-live="polite" className={mutedClass}>
          {t("share_saving")}
        </p>
      ) : null}
      {view === "ignored" ? <p role="status">{t("share_no_link")}</p> : null}
      {view === "invalid" ? (
        <p role="alert" className={alertClass}>
          {t("share_bad_link")}
        </p>
      ) : null}
      {view === "error" ? (
        <>
          <p role="alert" className={alertClass}>
            {t("share_failed")}
          </p>
          <button type="button" className={buttonClass} onClick={() => void runShare(setView)}>
            {t("try_again")}
          </button>
        </>
      ) : null}
      {view !== "working" ? (
        <p className="flex gap-4">
          <Link href="/" className={linkClass}>
            {t("home_link")}
          </Link>
          <Link href="/inbox" className={linkClass}>
            {t("nav_inbox")}
          </Link>
        </p>
      ) : null}
    </main>
  );
}

async function runShare(setView: (view: ShareView) => void) {
  const locale = readStoredLocale();
  setView("working");
  const toastId = toast.loading(tUi(locale, "share_saving"));
  const result = await openSharedLink();
  if (result === "saved") {
    toast.success(tUi(locale, "share_saved"), { id: toastId });
    window.location.assign("/inbox");
    return;
  }
  if (result === "needs-login") {
    toast.success(tUi(locale, "share_need_login"), { id: toastId });
    window.location.assign("/login");
    return;
  }
  if (result === "ignored") {
    toast.error(tUi(locale, "share_no_link"), { id: toastId });
  } else if (result === "invalid") {
    toast.error(tUi(locale, "share_bad_link"), { id: toastId });
  } else {
    toast.error(tUi(locale, "share_failed"), { id: toastId });
  }
  setView(result);
}
