"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import ThemeToggle from "@/components/ThemeToggle";
import { saveSharedUrl, type SharedUrlResult } from "@/lib/pending-share";
import { alertClass, authPageClass, buttonClass, linkClass, mutedClass, titleClass } from "@/lib/ui-classes";

type ShareView = "working" | "ignored" | "invalid" | "error";

async function openSharedLink(): Promise<SharedUrlResult> {
  const params = new URLSearchParams(window.location.search);
  return saveSharedUrl(params.get("url"));
}

export default function SharePage() {
  const [view, setView] = useState<ShareView>("working");

  useEffect(() => {
    void runShare(setView);
  }, []);

  return (
    <main className={authPageClass}>
      <div className="flex items-start justify-between gap-3">
        <h1 className={titleClass}>مشاركة رابط</h1>
        <ThemeToggle />
      </div>
      {view === "working" ? (
        <p aria-live="polite" className={mutedClass}>
          بنحفظ الرابط...
        </p>
      ) : null}
      {view === "ignored" ? (
        <p role="status">مفيش رابط. النص والصورة مش بيتسجلوا.</p>
      ) : null}
      {view === "invalid" ? (
        <p role="alert" className={alertClass}>
          الرابط لازم يبدأ بـ http أو https.
        </p>
      ) : null}
      {view === "error" ? (
        <>
          <p role="alert" className={alertClass}>
            مش قدرنا نحفظ الرابط.
          </p>
          <button type="button" className={buttonClass} onClick={() => void runShare(setView)}>
            حاول تاني
          </button>
        </>
      ) : null}
      {view !== "working" ? (
        <p className="flex gap-4">
          <Link href="/" className={linkClass}>
            الصفحة الرئيسية
          </Link>
          <Link href="/inbox" className={linkClass}>
            الوارد
          </Link>
        </p>
      ) : null}
    </main>
  );
}

async function runShare(setView: (view: ShareView) => void) {
  setView("working");
  const toastId = toast.loading("بنحفظ الرابط...");
  const result = await openSharedLink();
  if (result === "saved") {
    toast.success("اتحفظ الرابط", { id: toastId });
    window.location.assign("/inbox");
    return;
  }
  if (result === "needs-login") {
    toast.success("هنحوّلك على الدخول عشان نحفظ الرابط", { id: toastId });
    window.location.assign("/login");
    return;
  }
  if (result === "ignored") {
    toast.error("مفيش رابط. النص والصورة مش بيتسجلوا.", { id: toastId });
  } else if (result === "invalid") {
    toast.error("الرابط لازم يبدأ بـ http أو https.", { id: toastId });
  } else {
    toast.error("مش قدرنا نحفظ الرابط.", { id: toastId });
  }
  setView(result);
}
