"use client";

import type { PublicUser, RevivalList, TodayProgress } from "@revivenotes/shared";
import { useQuery } from "@tanstack/react-query";
import { Folder, Inbox, LayoutGrid, LogOut, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import AppLogo from "@/components/AppLogo";
import HeaderToggles from "@/components/HeaderToggles";
import RevivalScreen from "@/components/RevivalScreen";
import { api } from "@/lib/api";
import { boardPageClass, buttonSecondaryClass, iconButtonClass, mutedClass, pageClass } from "@/lib/ui-classes";
import { useT } from "@/lib/use-t";
import type { UiKey } from "@/lib/ui-copy";

type SignedInShellProps = {
  children: ReactNode;
  /** True on pages that show the sticky-note board, so it has room for several columns. */
  wide?: boolean;
};

const navLinks: { href: string; label: UiKey; Icon: LucideIcon }[] = [
  { href: "/inbox", label: "nav_inbox", Icon: Inbox },
  { href: "/items", label: "nav_all", Icon: LayoutGrid },
  { href: "/categories", label: "nav_categories", Icon: Folder },
  { href: "/settings", label: "nav_settings", Icon: Settings },
];

function isNoSession(error: unknown): boolean {
  return error instanceof Error && error.message === "no-session";
}

export function SignedInShell({ children, wide = false }: SignedInShellProps) {
  const pathname = usePathname();
  const { t } = useT();
  const [leaving, setLeaving] = useState(false);
  const me = useQuery({
    queryKey: ["me"],
    retry: false,
    enabled: typeof window !== "undefined",
    queryFn: async (): Promise<PublicUser> => {
      let response: Response;
      try {
        response = await api("/me");
      } catch {
        throw new Error("offline");
      }
      // 401 is a missing session. Any other failure means the server was reached
      // but the page should stay here instead of pretending to open login.
      if (response.status === 401) {
        throw new Error("no-session");
      }
      if (!response.ok) {
        throw new Error("offline");
      }
      return response.json() as Promise<PublicUser>;
    },
  });

  // One fetch while this browser tab stays open. A full reload builds a new
  // QueryClient and asks again. Moving between pages reuses this result.
  const revival = useQuery({
    queryKey: ["revival"],
    enabled: me.isSuccess,
    staleTime: Infinity,
    retry: false,
    queryFn: async (): Promise<RevivalList> => {
      let response: Response;
      try {
        response = await api("/revival");
      } catch {
        throw new Error("offline");
      }
      if (response.status === 401) {
        throw new Error("no-session");
      }
      if (!response.ok) {
        throw new Error("offline");
      }
      return response.json() as Promise<RevivalList>;
    },
  });

  const progress = useQuery({
    queryKey: ["progress"],
    enabled: me.isSuccess,
    retry: false,
    queryFn: async (): Promise<TodayProgress> => {
      let response: Response;
      try {
        response = await api("/progress/today");
      } catch {
        throw new Error("offline");
      }
      if (response.status === 401) {
        throw new Error("no-session");
      }
      if (!response.ok) {
        throw new Error("offline");
      }
      return response.json() as Promise<TodayProgress>;
    },
  });

  useEffect(() => {
    if (!isNoSession(me.error) && !isNoSession(revival.error) && !isNoSession(progress.error)) {
      return;
    }
    window.location.assign("/login");
  }, [me.error, revival.error, progress.error]);

  async function onLogout() {
    setLeaving(true);
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // The login page is the next stop either way.
    }
    window.location.assign("/login");
  }

  if (me.isPending) {
    return (
      <main className={pageClass}>
        <p className={mutedClass}>{t("confirming_session")}</p>
      </main>
    );
  }

  if (isNoSession(revival.error)) {
    return (
      <main className={pageClass}>
        <p className={mutedClass}>{t("redirecting_login")}</p>
      </main>
    );
  }

  if (me.isError || !me.data) {
    if (isNoSession(me.error)) {
      return (
        <main className={pageClass}>
          <p className={mutedClass}>{t("redirecting_login")}</p>
        </main>
      );
    }

    return (
      <main className={pageClass}>
        <p>{t("offline")}</p>
        <button type="button" onClick={() => void me.refetch()} className={buttonSecondaryClass}>
          {t("try_again")}
        </button>
      </main>
    );
  }

  const revivalItems = revival.data?.items ?? [];
  const showRevival = revivalItems.length > 0;
  const waitingForRevival = revival.isPending || revival.isError || !revival.data;
  const hideNav = showRevival || waitingForRevival;
  const mainClass = wide || showRevival ? boardPageClass : pageClass;

  return (
    <>
      {/* No backdrop blur below md: it would pin the fixed bottom tab bar to this header instead of the screen. */}
      <header className="z-20 border-b border-rn-border bg-rn-surface md:sticky md:top-0 md:bg-rn-surface/85 md:backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-3 md:px-6">
          <Link
            href="/inbox"
            className="flex min-w-0 items-center gap-2.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rn-accent"
          >
            <AppLogo size={36} />
            <span className="truncate text-lg font-semibold tracking-tight text-rn-ink">{t("app_name")}</span>
          </Link>
          {hideNav ? null : (
            <nav
              className="fixed inset-x-0 bottom-0 z-20 border-t border-rn-border bg-rn-surface/95 px-2 pt-1.5 pb-2 backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
              aria-label={t("nav_label")}
            >
              <ul className="mx-auto flex max-w-xl gap-1">
                {navLinks.map(({ href, label, Icon }) => {
                  const current = pathname === href || pathname.startsWith(`${href}/`);
                  return (
                    <li key={href} className="flex-1 md:flex-none">
                      <Link
                        href={href}
                        aria-current={current ? "page" : undefined}
                        className={`flex flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rn-accent md:flex-row md:gap-2 md:px-3 md:py-2 md:text-sm ${
                          current
                            ? "bg-rn-accent text-rn-accent-ink"
                            : "text-rn-muted hover:bg-rn-accent-soft hover:text-rn-ink"
                        }`}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                        <span>{t(label)}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          )}
          <HeaderToggles>
            <button
              type="button"
              onClick={onLogout}
              disabled={leaving}
              aria-label={t("logout")}
              title={t("logout")}
              className={iconButtonClass}
            >
              <LogOut className="size-5 rtl:-scale-x-100" aria-hidden="true" />
            </button>
          </HeaderToggles>
        </div>
      </header>
      <main className={mainClass}>
        <div className="flex flex-col gap-2">
          <p className={`truncate text-sm ${mutedClass}`}>{me.data.email}</p>
          {progress.isSuccess ? (
            <p className={`rounded-xl border border-rn-border bg-rn-surface/70 px-3 py-2 text-sm ${mutedClass}`}>
              {t("progress_cleared")}{" "}
              <span dir="ltr" className="font-semibold text-rn-accent">
                {progress.data.cleared}
              </span>
            </p>
          ) : null}
          {progress.isError && !isNoSession(progress.error) ? (
            <p className={mutedClass}>{t("progress_error")}</p>
          ) : null}
        </div>
        {revival.isPending ? <p className={mutedClass}>{t("revival_checking")}</p> : null}
        {revival.isError ? (
          <div className="flex flex-col gap-3">
            <p>{t("revival_error")}</p>
            <button
              type="button"
              onClick={() => void revival.refetch()}
              className={`w-fit ${buttonSecondaryClass}`}
            >
              {t("try_again")}
            </button>
          </div>
        ) : null}
        {showRevival ? <RevivalScreen items={revivalItems} /> : null}
        {hideNav ? null : children}
      </main>
    </>
  );
}
