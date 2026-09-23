"use client";

import type { PublicUser, RevivalList, TodayProgress } from "@revivenotes/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import RevivalScreen from "@/components/RevivalScreen";
import ThemeToggle from "@/components/ThemeToggle";
import { api } from "@/lib/api";
import { buttonSecondaryClass, mutedClass, pageClass } from "@/lib/ui-classes";

type SignedInShellProps = {
  children: ReactNode;
};

const links = [
  { href: "/inbox", label: "الوارد" },
  { href: "/items", label: "الكل" },
  { href: "/categories", label: "تصنيفات" },
  { href: "/settings", label: "إعدادات" },
];

function isNoSession(error: unknown): boolean {
  return error instanceof Error && error.message === "no-session";
}

export function SignedInShell({ children }: SignedInShellProps) {
  const pathname = usePathname();
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
        <p className={mutedClass}>بنأكد الجلسة...</p>
      </main>
    );
  }

  if (isNoSession(revival.error)) {
    return (
      <main className={pageClass}>
        <p className={mutedClass}>بنحوّلك على صفحة الدخول...</p>
      </main>
    );
  }

  if (me.isError || !me.data) {
    if (isNoSession(me.error)) {
      return (
        <main className={pageClass}>
          <p className={mutedClass}>بنحوّلك على صفحة الدخول...</p>
        </main>
      );
    }

    return (
      <main className={pageClass}>
        <p>مش قادرين نوصل للسيرفر</p>
        <button type="button" onClick={() => void me.refetch()} className={buttonSecondaryClass}>
          حاول تاني
        </button>
      </main>
    );
  }

  const revivalItems = revival.data?.items ?? [];
  const showRevival = revivalItems.length > 0;
  const waitingForRevival = revival.isPending || revival.isError || !revival.data;
  const hideNav = showRevival || waitingForRevival;

  return (
    <main className={pageClass}>
      <header className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-lg font-semibold tracking-tight text-rn-ink">ريفايف نوتس</p>
            <p className={`truncate text-sm ${mutedClass}`}>{me.data.email}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={onLogout}
              disabled={leaving}
              className={buttonSecondaryClass}
            >
              خروج
            </button>
          </div>
        </div>
        {progress.isSuccess ? (
          <p className={`rounded-xl border border-rn-border bg-rn-surface/70 px-3 py-2 text-sm ${mutedClass}`}>
            خلّصت النهارده{" "}
            <span dir="ltr" className="font-semibold text-rn-accent">
              {progress.data.cleared}
            </span>
          </p>
        ) : null}
        {progress.isError && !isNoSession(progress.error) ? (
          <p className={mutedClass}>مش قادرين نجيب العدّاد</p>
        ) : null}
        {hideNav ? null : (
          <nav
            className="fixed inset-x-0 bottom-0 z-20 border-t border-rn-border bg-rn-surface/95 px-2 py-2 backdrop-blur-md md:static md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none"
            aria-label="التنقل"
          >
            <div className="mx-auto flex max-w-xl gap-1 md:flex-wrap md:gap-2">
              {links.map((link) => {
                const current = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={current ? "page" : undefined}
                    className={`flex-1 rounded-xl px-3 py-2.5 text-center text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rn-accent md:flex-none ${
                      current
                        ? "bg-rn-accent text-rn-accent-ink"
                        : "text-rn-muted hover:bg-rn-accent-soft hover:text-rn-ink"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </nav>
        )}
      </header>
      {revival.isPending ? <p className={mutedClass}>بنشوف الملاحظات القديمة...</p> : null}
      {revival.isError ? (
        <div className="flex flex-col gap-3">
          <p>مش قادرين نجيب الملاحظات القديمة</p>
          <button
            type="button"
            onClick={() => void revival.refetch()}
            className={`w-fit ${buttonSecondaryClass}`}
          >
            حاول تاني
          </button>
        </div>
      ) : null}
      {showRevival ? <RevivalScreen items={revivalItems} /> : null}
      {hideNav ? null : children}
    </main>
  );
}
