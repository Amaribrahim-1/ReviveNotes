"use client";

import type { PublicUser, RevivalList, TodayProgress } from "@revivenotes/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import RevivalScreen from "@/components/RevivalScreen";
import { api } from "@/lib/api";

type SignedInShellProps = {
  children: ReactNode;
};

const links = [
  { href: "/inbox", label: "الوارد" },
  { href: "/items", label: "كل الملاحظات" },
  { href: "/categories", label: "التصنيفات والوسوم" },
  { href: "/settings", label: "الإعدادات" },
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
      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-6 py-10">
        <p>بنأكد الجلسة...</p>
      </main>
    );
  }

  if (isNoSession(revival.error)) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-6 py-10">
        <p>بنحوّلك على صفحة الدخول...</p>
      </main>
    );
  }

  if (me.isError || !me.data) {
    if (isNoSession(me.error)) {
      return (
        <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-6 py-10">
          <p>بنحوّلك على صفحة الدخول...</p>
        </main>
      );
    }

    return (
      <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-6 py-10">
        <p>مش قادرين نوصل للسيرفر</p>
        <button
          type="button"
          onClick={() => void me.refetch()}
          className="w-fit rounded border border-neutral-300 px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
        >
          حاول تاني
        </button>
      </main>
    );
  }

  const revivalItems = revival.data?.items ?? [];
  const showRevival = revivalItems.length > 0;
  const waitingForRevival = revival.isPending || revival.isError || !revival.data;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-6 py-10">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <p>{me.data.email}</p>
          <button
            type="button"
            onClick={onLogout}
            disabled={leaving}
            className="rounded border border-neutral-300 px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 disabled:opacity-60"
          >
            خروج
          </button>
        </div>
        {progress.isSuccess ? (
          <p>
            خلّصت النهارده <span dir="ltr">{progress.data.cleared}</span>
          </p>
        ) : null}
        {progress.isError && !isNoSession(progress.error) ? <p>مش قادرين نجيب العدّاد</p> : null}
        {showRevival || waitingForRevival ? null : (
          <nav className="flex flex-wrap gap-4" aria-label="التنقل">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={pathname === link.href ? "page" : undefined}
                className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      {revival.isPending ? <p>بنشوف الملاحظات القديمة...</p> : null}
      {revival.isError ? (
        <div className="flex flex-col gap-3">
          <p>مش قادرين نجيب الملاحظات القديمة</p>
          <button
            type="button"
            onClick={() => void revival.refetch()}
            className="w-fit rounded border border-neutral-300 px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900"
          >
            حاول تاني
          </button>
        </div>
      ) : null}
      {showRevival ? <RevivalScreen items={revivalItems} /> : null}
      {showRevival || waitingForRevival ? null : children}
    </main>
  );
}
