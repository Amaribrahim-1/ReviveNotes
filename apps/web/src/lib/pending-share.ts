import { createItemSchema } from "@revivenotes/shared";
import { api } from "@/lib/api";

// One tab. A later login in this same tab reads it. A new tab does not.
const SHARE_URL_KEY = "revivenotes.pendingShareUrl";

export type SharedUrlResult = "saved" | "needs-login" | "ignored" | "invalid" | "error";

// Dev runs the share page effect twice. The second call waits on this same request.
let inFlight: { url: string; promise: Promise<SharedUrlResult> } | null = null;
// If the first request already created the item, a later effect must not POST again.
const savedUrls = new Set<string>();

function rememberShareUrl(url: string) {
  sessionStorage.setItem(SHARE_URL_KEY, url);
}

function readShareUrl(): string | null {
  return sessionStorage.getItem(SHARE_URL_KEY);
}

export function hasRememberedShare(): boolean {
  const raw = readShareUrl();
  if (!raw) {
    return false;
  }
  return createItemSchema.safeParse({ type: "link", content: raw }).success;
}

function forgetShareUrl() {
  sessionStorage.removeItem(SHARE_URL_KEY);
}

export function saveSharedUrl(raw: string | null): Promise<SharedUrlResult> {
  const url = raw?.trim() ?? "";
  if (!url) {
    return Promise.resolve("ignored");
  }

  const parsed = createItemSchema.safeParse({ type: "link", content: url });
  if (!parsed.success) {
    return Promise.resolve("invalid");
  }

  const content = parsed.data.content;
  if (savedUrls.has(content)) {
    return Promise.resolve("saved");
  }
  if (inFlight?.url === content) {
    return inFlight.promise;
  }

  const promise = postSharedLink(content).finally(() => {
    if (inFlight?.promise === promise) {
      inFlight = null;
    }
  });
  inFlight = { url: content, promise };
  return promise;
}

async function postSharedLink(url: string): Promise<SharedUrlResult> {
  // Write first. A 401 sends the browser to login before this function continues.
  rememberShareUrl(url);
  try {
    const response = await api("/items", {
      method: "POST",
      body: JSON.stringify({ type: "link", content: url }),
    });
    if (response.status === 401) {
      return "needs-login";
    }
    if (!response.ok) {
      return "error";
    }
    savedUrls.add(url);
    forgetShareUrl();
    return "saved";
  } catch {
    return "error";
  }
}

// Login and register call this after the session exists. A missing URL is a normal login.
export async function createRememberedShare(): Promise<"none" | "saved" | "error"> {
  const raw = readShareUrl();
  if (!raw) {
    return "none";
  }

  const parsed = createItemSchema.safeParse({ type: "link", content: raw });
  if (!parsed.success) {
    forgetShareUrl();
    return "none";
  }

  const content = parsed.data.content;
  if (savedUrls.has(content)) {
    forgetShareUrl();
    return "saved";
  }

  try {
    const response = await api("/items", {
      method: "POST",
      body: JSON.stringify({ type: "link", content }),
    });
    if (!response.ok) {
      return "error";
    }
    savedUrls.add(content);
    forgetShareUrl();
    return "saved";
  } catch {
    return "error";
  }
}
