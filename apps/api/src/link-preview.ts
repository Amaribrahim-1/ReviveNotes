import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { LinkPreview } from "@revivenotes/shared";

const TIMEOUT_MS = 5000;
const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;

const METADATA_HOSTS = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
  "instance-data.ec2.internal",
]);

type PreviewLoader = (url: string, init: RequestInit) => Promise<Response>;

// True only for an http(s) URL whose addresses are all public.
// A hostname string that looks public is not enough: it may resolve to a private address.
export async function urlIsSafeToFetch(raw: string, signal?: AbortSignal): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  if (url.username !== "" || url.password !== "") {
    return false;
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (isMetadataHost(hostname)) {
    return false;
  }

  const literal = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  if (isIP(literal) !== 0) {
    return !isBlockedAddress(literal);
  }

  const addresses = await lookupAddresses(hostname, signal);
  if (!addresses || addresses.length === 0) {
    return false;
  }
  for (const address of addresses) {
    if (isBlockedAddress(address)) {
      return false;
    }
  }
  return true;
}

export async function fetchLinkPreview(pageUrl: string, load: PreviewLoader = fetch): Promise<LinkPreview | null> {
  try {
    return await readPreview(pageUrl, AbortSignal.timeout(TIMEOUT_MS), load);
  } catch {
    return null;
  }
}

async function readPreview(pageUrl: string, signal: AbortSignal, load: PreviewLoader): Promise<LinkPreview | null> {
  let current = pageUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (signal.aborted) {
      return null;
    }
    // The same check runs on the first URL and on every redirect target.
    if (!(await urlIsSafeToFetch(current, signal))) {
      return null;
    }

    const response = await load(current, {
      redirect: "manual",
      signal,
      credentials: "omit",
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent": "ReviveNotes",
      },
    });

    if (isRedirect(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location || hop === MAX_REDIRECTS) {
        return null;
      }
      try {
        current = new URL(location, current).href;
      } catch {
        return null;
      }
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }

    const html = await readHtml(response);
    if (!html) {
      return null;
    }
    return openGraphFrom(html, current, signal);
  }

  return null;
}

function isRedirect(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308;
}

async function readHtml(response: Response): Promise<string | null> {
  const header = response.headers.get("content-type");
  if (header) {
    const base = header.split(";")[0]?.trim().toLowerCase() ?? "";
    if (base !== "text/html" && base !== "application/xhtml+xml") {
      await response.body?.cancel().catch(() => undefined);
      return null;
    }
  }

  const body = response.body;
  if (!body) {
    return null;
  }

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BYTES) {
      const step = await reader.read();
      if (step.done) {
        break;
      }
      const room = MAX_BYTES - total;
      const piece = step.value.byteLength > room ? step.value.slice(0, room) : step.value;
      chunks.push(piece);
      total += piece.byteLength;
      if (step.value.byteLength > room) {
        break;
      }
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function openGraphFrom(html: string, pageUrl: string, signal: AbortSignal): Promise<LinkPreview | null> {
  const siteName = clip(readMeta(html, "og:site_name"), 120);
  const title = clip(readMeta(html, "og:title"), 300);
  const description = clip(readMeta(html, "og:description"), 400);
  const imageUrl = await imageUrlFrom(readMeta(html, "og:image"), pageUrl, signal);

  if (!siteName && !title && !description && !imageUrl) {
    return null;
  }

  return {
    site_name: siteName,
    title,
    description,
    image_url: imageUrl,
  };
}

async function imageUrlFrom(raw: string | null, pageUrl: string, signal: AbortSignal): Promise<string | null> {
  if (!raw) {
    return null;
  }
  let resolved: URL;
  try {
    resolved = new URL(raw, pageUrl);
  } catch {
    return null;
  }
  if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
    return null;
  }
  if (resolved.href.length > 2000) {
    return null;
  }
  // The browser will request this URL. A private image address is dropped. The bytes are not copied.
  if (!(await urlIsSafeToFetch(resolved.href, signal))) {
    return null;
  }
  return resolved.href;
}

function readMeta(html: string, property: string): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const name = (readAttr(tag, "property") ?? readAttr(tag, "name") ?? "").toLowerCase();
    if (name !== property) {
      continue;
    }
    const content = readAttr(tag, "content");
    if (content) {
      return decodeHtml(content);
    }
  }
  return null;
}

function readAttr(tag: string, name: string): string | null {
  const pattern = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'=<>]+))`, "i");
  const found = pattern.exec(tag);
  if (!found) {
    return null;
  }
  return found[2] ?? found[3] ?? found[4] ?? null;
}

function decodeHtml(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (entity) => {
    const body = entity.slice(1, -1);
    const lower = body.toLowerCase();
    if (lower === "amp") return "&";
    if (lower === "lt") return "<";
    if (lower === "gt") return ">";
    if (lower === "quot") return '"';
    if (lower === "apos") return "'";
    if (lower === "nbsp") return " ";
    if (body.startsWith("#")) {
      const code =
        body[1] === "x" || body[1] === "X"
          ? Number.parseInt(body.slice(2), 16)
          : Number.parseInt(body.slice(1), 10);
      if (!Number.isInteger(code) || code < 0 || code > 0x10ffff) {
        return entity;
      }
      return String.fromCodePoint(code);
    }
    return entity;
  });
}

function clip(value: string | null, max: number): string | null {
  if (!value) {
    return null;
  }
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }
  if (text.length <= max) {
    return text;
  }
  return text.slice(0, max);
}

function isMetadataHost(hostname: string): boolean {
  if (METADATA_HOSTS.has(hostname)) {
    return true;
  }
  if (hostname.endsWith(".localhost")) {
    return true;
  }
  if (hostname.endsWith(".metadata.google.internal")) {
    return true;
  }
  return false;
}

async function lookupAddresses(hostname: string, signal?: AbortSignal): Promise<string[] | null> {
  try {
    const pending = lookup(hostname, { all: true, order: "verbatim" });
    const records = signal ? await raceSignal(pending, signal) : await pending;
    return records.map((record) => record.address);
  } catch {
    return null;
  }
}

function raceSignal<T>(pending: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(signal.reason);
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      reject(signal.reason);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    pending.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function isBlockedAddress(address: string): boolean {
  const ipv4 = ipv4Parts(address);
  if (ipv4) {
    return isBlockedIpv4(ipv4);
  }
  const hextets = ipv6Hextets(address);
  if (!hextets) {
    return true;
  }
  return isBlockedIpv6(hextets);
}

function ipv4Parts(address: string): [number, number, number, number] | null {
  const parts = address.split(".");
  if (parts.length !== 4) {
    return null;
  }
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) {
      return null;
    }
    const value = Number(part);
    if (value > 255) {
      return null;
    }
    numbers.push(value);
  }
  return [numbers[0] ?? 0, numbers[1] ?? 0, numbers[2] ?? 0, numbers[3] ?? 0];
}

function isBlockedIpv4(parts: [number, number, number, number]): boolean {
  const a = parts[0];
  const b = parts[1];
  if (a === 0 || a === 10 || a === 127) {
    return true;
  }
  if (a === 169 && b === 254) {
    return true;
  }
  if (a === 172 && b >= 16 && b <= 31) {
    return true;
  }
  if (a === 192 && b === 168) {
    return true;
  }
  return false;
}

// A dotted tail (::ffff:127.0.0.1) becomes two hex groups so it matches ::ffff:7f00:1.
function ipv6Hextets(address: string): number[] | null {
  let bare = address.toLowerCase();
  if (bare.startsWith("[") && bare.endsWith("]")) {
    bare = bare.slice(1, -1);
  }
  const zone = bare.indexOf("%");
  if (zone !== -1) {
    bare = bare.slice(0, zone);
  }

  const dotted = bare.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (dotted) {
    const tail = ipv4Parts(dotted[2] ?? "");
    if (!tail) {
      return null;
    }
    const high = (tail[0] << 8) | tail[1];
    const low = (tail[2] << 8) | tail[3];
    bare = `${dotted[1]}${high.toString(16)}:${low.toString(16)}`;
  }

  const halves = bare.split("::");
  if (halves.length > 2) {
    return null;
  }

  const left = parseHextets(halves[0] ?? "");
  if (!left) {
    return null;
  }
  if (halves.length === 1) {
    return left.length === 8 ? left : null;
  }
  const right = parseHextets(halves[1] ?? "");
  if (!right) {
    return null;
  }
  if (left.length + right.length > 8) {
    return null;
  }

  const zeros = new Array<number>(8 - left.length - right.length).fill(0);
  return [...left, ...zeros, ...right];
}

function parseHextets(side: string): number[] | null {
  if (side.length === 0) {
    return [];
  }
  const parts = side.split(":");
  const numbers: number[] = [];
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) {
      return null;
    }
    numbers.push(Number.parseInt(part, 16));
  }
  return numbers;
}

function isBlockedIpv6(hextets: number[]): boolean {
  const first = hextets[0] ?? 0;
  if ((first & 0xffc0) === 0xfe80) {
    return true;
  }
  if ((first & 0xfe00) === 0xfc00) {
    return true;
  }

  const embedded = embeddedIpv4(hextets);
  if (embedded) {
    return isBlockedIpv4(embedded);
  }

  return false;
}

function embeddedIpv4(hextets: number[]): [number, number, number, number] | null {
  const mapped =
    hextets[0] === 0 &&
    hextets[1] === 0 &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0 &&
    (hextets[5] === 0xffff || hextets[5] === 0);
  const sixToFour = hextets[0] === 0x2002;
  const nat64 =
    hextets[0] === 0x64 &&
    hextets[1] === 0xff9b &&
    hextets[2] === 0 &&
    hextets[3] === 0 &&
    hextets[4] === 0 &&
    hextets[5] === 0;

  let high = 0;
  let low = 0;
  if (mapped || nat64) {
    high = hextets[6] ?? 0;
    low = hextets[7] ?? 0;
  } else if (sixToFour) {
    high = hextets[1] ?? 0;
    low = hextets[2] ?? 0;
  } else {
    return null;
  }

  // :: and ::1 are loopback. Treat them like 127.0.0.1.
  if (mapped && hextets[5] === 0 && high === 0 && (low === 0 || low === 1)) {
    return [127, 0, 0, 1];
  }

  return [(high >> 8) & 255, high & 255, (low >> 8) & 255, low & 255];
}
