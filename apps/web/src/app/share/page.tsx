"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { saveSharedUrl, type SharedUrlResult } from "@/lib/pending-share";

type ShareView = "working" | "ignored" | "invalid" | "error";

const linkClass =
  "underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";
const buttonClass =
  "rounded bg-neutral-900 px-4 py-2 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900";

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
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-10">
      <h1 className="text-3xl font-semibold">مشاركة رابط</h1>
      {view === "working" ? <p aria-live="polite">بنحفظ الرابط...</p> : null}
      {view === "ignored" ? (
        <p role="status">مفيش رابط. النص والصورة مش بيتسجلوا.</p>
      ) : null}
      {view === "invalid" ? (
        <p role="alert">الرابط لازم يبدأ بـ http أو https.</p>
      ) : null}
      {view === "error" ? (
        <>
          <p role="alert">مش قدرنا نحفظ الرابط.</p>
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
  const result = await openSharedLink();
  if (result === "saved") {
    window.location.assign("/inbox");
    return;
  }
  if (result === "needs-login") {
    window.location.assign("/login");
    return;
  }
  setView(result);
}
