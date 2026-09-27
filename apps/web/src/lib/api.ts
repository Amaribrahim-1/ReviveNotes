import { tMsg } from "@revivenotes/shared";
import { readStoredLocale } from "@/lib/locale-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

let refreshInFlight: Promise<boolean> | null = null;

function apiBase(): string {
  return API_URL.replace(/\/$/, "");
}

function sendToLogin() {
  if (typeof window === "undefined") {
    return;
  }
  window.location.assign("/login");
}

// One refresh for every 401 that arrives together. The retry does not start a second one.
function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${apiBase()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Accept-Language": readStoredLocale(),
      },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }

  return refreshInFlight;
}

export async function api(
  path: string,
  init: RequestInit = {},
  alreadyRetried = false,
): Promise<Response> {
  const headers = new Headers(init.headers);
  const bodyIsForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  // FormData sets its own multipart boundary. A JSON content type would drop the file.
  if (init.body !== undefined && !bodyIsForm && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!headers.has("Accept-Language")) {
    headers.set("Accept-Language", readStoredLocale());
  }

  // Cookies are httpOnly. The browser sends them only when credentials is include.
  const response = await fetch(`${apiBase()}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (response.status !== 401 || path.startsWith("/auth/")) {
    return response;
  }

  if (alreadyRetried) {
    sendToLogin();
    return response;
  }

  const refreshed = await refreshSession();
  if (!refreshed) {
    sendToLogin();
    return response;
  }

  return api(path, init, true);
}

function fetchMe(): Promise<Response> {
  return fetch(`${apiBase()}/me`, {
    credentials: "include",
    headers: {
      "Accept-Language": readStoredLocale(),
    },
  });
}

// The landing, login, and register pages ask this on load. Unlike api(), it never
// sends the browser to /login, so /login can call it without reloading itself.
// The access cookie lives 15 minutes, so a 401 tries the 30-day refresh cookie once.
export async function hasSession(): Promise<boolean> {
  try {
    const first = await fetchMe();
    if (first.status !== 401) {
      return first.ok;
    }

    const refreshed = await refreshSession();
    if (!refreshed) {
      return false;
    }

    const second = await fetchMe();
    return second.ok;
  } catch {
    return false;
  }
}

export async function apiError(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  if (typeof body === "object" && body !== null && "error" in body && typeof body.error === "string") {
    return body.error;
  }
  return tMsg(readStoredLocale(), "generic_error");
}
