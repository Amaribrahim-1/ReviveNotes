"use client";

import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { hasSession } from "@/lib/api";

// True only when the check finished and nobody is signed in, so the page never
// flashes its login buttons before leaving for /inbox.
export function useRedirectIfSignedIn(): boolean {
  const router = useRouter();
  const session = useQuery({
    queryKey: ["session-check"],
    queryFn: hasSession,
    retry: false,
    enabled: typeof window !== "undefined",
  });

  useEffect(() => {
    if (session.data === true) {
      // replace, so Back does not land on this page and bounce again.
      router.replace("/inbox");
    }
  }, [session.data, router]);

  return session.data === false;
}
