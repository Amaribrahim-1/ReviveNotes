"use client";

import Link from "next/link";
import HeaderToggles from "@/components/HeaderToggles";
import { authPageClass, buttonClass, linkClass, mutedClass, titleClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";

export default function HomePage() {
  const { t } = useT();

  return (
    <main className={`${authPageClass} min-h-screen justify-center`}>
      <div className="flex justify-end">
        <HeaderToggles />
      </div>
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-rn-accent">{t("app_tagline")}</p>
        <h1 className={`${titleClass} text-4xl leading-tight md:text-5xl`}>{t("app_name")}</h1>
        <p className={`text-lg leading-relaxed ${mutedClass}`}>{t("app_blurb")}</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/register" className={`${buttonClass} text-center`}>
          {t("register")}
        </Link>
        <Link href="/login" className={`${buttonClass} bg-rn-surface text-center text-rn-ink ring-1 ring-rn-border`}>
          {t("login")}
        </Link>
      </div>
      <p className={`text-sm ${mutedClass}`}>
        {t("or_go_to")}{" "}
        <Link href="/inbox" className={linkClass}>
          {t("nav_inbox")}
        </Link>{" "}
        {t("if_already_in")}
      </p>
    </main>
  );
}
