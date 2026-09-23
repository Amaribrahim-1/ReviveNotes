"use client";

import type { PublicUser } from "@revivenotes/shared";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
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

  useEffect(() => {
    if (!isNoSession(me.error)) {
      return;
    }
    window.location.assign("/login");
  }, [me.error]);

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
      </header>
      {children}
    </main>
  );
}
