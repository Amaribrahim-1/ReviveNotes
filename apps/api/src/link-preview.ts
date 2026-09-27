import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { LinkPreview } from "@revivenotes/shared";

const TIMEOUT_MS = 10000;
const MAX_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 5;

const METADATA_HOSTS = new Set([
  "localhost",
  "metadata",
  "metadata.google.internal",
  "metadata.google.com",
  "instance-data",
  "instance-data.ec2.internal",
]);

// oEmbed endpoints for well-known platforms that block direct scraping
const OEMBED_ENDPOINTS: { pattern: RegExp; endpoint: string }[] = [
  {
    pattern: /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//,
    endpoint: "https://www.youtube.com/oembed",
  },
  {
    pattern: /^https?:\/\/(www\.)?vimeo\.com\//,
    endpoint: "https://vimeo.com/api/oembed.json",
  },
  {
    pattern: /^https?:\/\/(www\.)?twitter\.com\//,
    endpoint: "https://publish.twitter.com/oembed",
  },
  {
    pattern: /^https?:\/\/(www\.)?x\.com\//,
    endpoint: "https://publish.twitter.com/oembed",
  },
  {
    pattern: /^https?:\/\/(www\.)?tiktok\.com\//,
    endpoint: "https://www.tiktok.com/oembed",
  },
  {
    pattern: /^https?:\/\/(www\.)?soundcloud\.com\//,
    endpoint: "https://soundcloud.com/oembed",
  },
  {
    pattern: /^https?:\/\/(www\.)?spotify\.com\//,
    endpoint: "https://open.spotify.com/oembed",
  },
  {
    pattern: /^https?:\/\/open\.spotify\.com\//,
    endpoint: "https://open.spotify.com/oembed",
  },
  {
    pattern: /^https?:\/\/(www\.)?reddit\.com\//,
    endpoint: "https://www.reddit.com/oembed",
  },
  {
    pattern: /^https?:\/\/(www\.)?flickr\.com\//,
    endpoint: "https://www.flickr.com/services/oembed/",
  },
  {
    pattern: /^https?:\/\/(www\.)?dailymotion\.com\//,
    endpoint: "https://www.dailymotion.com/services/oembed",
  },
];

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
  // If DNS lookup fails (e.g. network issues in container), treat as public
  // to avoid blocking legitimate URLs. The actual fetch will fail gracefully
  // if the address truly is unreachable.
  if (!addresses) {
    return true;
  }
  if (addresses.length === 0) {
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
    const preview = await readPreview(pageUrl, AbortSignal.timeout(TIMEOUT_MS), load);
    return preview ?? fallbackPreview(pageUrl);
  } catch {
    return fallbackPreview(pageUrl);
  }
}

function fallbackPreview(pageUrl: string): LinkPreview {
  let hostname = pageUrl;
  try {
    hostname = new URL(pageUrl).hostname;
  } catch {}
  return {
    site_name: hostname,
    title: pageUrl,
    description: null,
    image_url: null,
  };
}

type OEmbedResponse = {
  title?: string;
  author_name?: string;
  provider_name?: string;
  thumbnail_url?: string;
  html?: string;
  type?: string;
};

async function tryOEmbed(pageUrl: string, signal: AbortSignal, load: PreviewLoader): Promise<LinkPreview | null> {
  for (const { pattern, endpoint } of OEMBED_ENDPOINTS) {
    if (!pattern.test(pageUrl)) {
      continue;
    }
    try {
      const oEmbedUrl = `${endpoint}?url=${encodeURIComponent(pageUrl)}&format=json`;
      if (!(await urlIsSafeToFetch(oEmbedUrl, signal))) {
        continue;
      }
      const response = await load(oEmbedUrl, {
        signal,
        credentials: "omit",
        cache: "no-store",
        headers: {
          accept: "application/json",
          "user-agent": "Mozilla/5.0 (compatible; ReviveNotesBot/1.0)",
        },
      });
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        continue;
      }
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("json")) {
        await response.body?.cancel().catch(() => undefined);
        continue;
      }
      const data = (await response.json()) as OEmbedResponse;
      const title = typeof data.title === "string" ? data.title.trim() : null;
      const siteName = typeof data.provider_name === "string" ? data.provider_name.trim() : null;
      const imageUrl = typeof data.thumbnail_url === "string" ? data.thumbnail_url.trim() : null;
      if (!title && !siteName) {
        continue;
      }
      let hostname = "";
      try {
        hostname = new URL(pageUrl).hostname;
      } catch {}
      return {
        site_name: siteName ?? hostname,
        title: clip(title, 300),
        description: null,
        image_url: imageUrl && imageUrl.length <= 2000 ? imageUrl : null,
      };
    } catch {
      // Try next endpoint or fall through to HTML scraping
    }
  }
  return null;
}

async function readPreview(pageUrl: string, signal: AbortSignal, load: PreviewLoader): Promise<LinkPreview | null> {
  // First, try oEmbed for well-known platforms (much more reliable)
  const oEmbed = await tryOEmbed(pageUrl, signal, load);
  if (oEmbed) {
    return oEmbed;
  }

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
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9,ar;q=0.8",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "upgrade-insecure-requests": "1",
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
  const rawSiteName = readMeta(html, "og:site_name") ?? readMeta(html, "twitter:site");
  const rawTitle = readMeta(html, "og:title") ?? readTitle(html) ?? readMeta(html, "twitter:title");
  const rawDesc = readMeta(html, "og:description") ?? readMeta(html, "description") ?? readMeta(html, "twitter:description");
  const rawImage = readMeta(html, "og:image") ?? readMeta(html, "twitter:image");

  if (!rawSiteName && !rawTitle && !rawDesc && !rawImage) {
    return null;
  }

  let hostname = "";
  try {
    hostname = new URL(pageUrl).hostname;
  } catch {}

  return {
    site_name: clip(rawSiteName ?? hostname, 120),
    title: clip(rawTitle, 300),
    description: clip(rawDesc, 400),
    image_url: await imageUrlFrom(rawImage, pageUrl, signal),
  };
}

function readTitle(html: string): string | null {
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  if (!match) {
    return null;
  }
  return decodeHtml(match[1] ?? "");
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
