import { randomUUID } from "node:crypto";
import { linkPreviewSchema } from "@revivenotes/shared";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "./app.js";
import { prisma } from "./db.js";
import { fetchLinkPreview, urlIsSafeToFetch } from "./link-preview.js";

const password = "password-ok";
const emails: string[] = [];

let cookiesA = "";
let cookiesB = "";

function nextEmail(label: string): string {
  const email = `t12-${label}-${randomUUID()}@example.com`;
  emails.push(email);
  return email;
}

function cookieHeader(response: { headers: { "set-cookie"?: string | string[] } }): string {
  const header = response.headers["set-cookie"];
  if (!header) {
    throw new Error("expected Set-Cookie");
  }
  const lines = Array.isArray(header) ? header : [header];
  return lines.map((line) => line.split(";")[0] ?? "").join("; ");
}

function postRegister(email: string) {
  return request(app).post("/auth/register").send({
    email,
    password,
    timezone: "Africa/Cairo",
  });
}

const savedHtml = [
  "<meta content='Example' property='og:site_name'>",
  '<meta property="og:title" content="A &amp; B">',
  '<meta property="og:description" content="Short text">',
  '<meta property="og:image" content="/cover.png">',
].join("");

const savedPreview = {
  site_name: "Example",
  title: "A & B",
  description: "Short text",
  image_url: "http://1.1.1.1/cover.png",
};

function pageResponse(html: string, status = 200, location?: string): Response {
  const headers = new Headers({ "content-type": "text/html" });
  if (location) {
    headers.set("location", location);
  }
  const body = status >= 300 && status < 400 ? null : html;
  return new Response(body, { status, headers });
}

beforeAll(async () => {
  const createdA = await postRegister(nextEmail("a"));
  const createdB = await postRegister(nextEmail("b"));
  expect(createdA.status).toBe(201);
  expect(createdB.status).toBe(201);
  cookiesA = cookieHeader(createdA);
  cookiesB = cookieHeader(createdB);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

afterAll(async () => {
  if (emails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
  }
});

describe("link preview guard", () => {
  it.each([
    "http://127.0.0.1/",
    "http://127.0.0.2/",
    "http://10.1.2.3/",
    "http://172.16.0.1/",
    "http://172.31.255.1/",
    "http://192.168.1.20/",
    "http://169.254.169.254/",
    "http://0.0.0.0/",
    "http://2130706433/",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://[fd00::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:169.254.169.254]/",
    "http://localhost/",
    "http://metadata.google.internal/",
    "http://metadata.google.com/",
    "ftp://1.1.1.1/",
  ])("refuses %s", async (target) => {
    expect(await urlIsSafeToFetch(target)).toBe(false);
  });

  it.each([
    "http://1.1.1.1/",
    "http://8.8.8.8/",
    "http://172.15.0.1/",
    "http://172.32.0.1/",
    "http://[2606:4700:4700::1111]/",
  ])("allows %s", async (target) => {
    expect(await urlIsSafeToFetch(target)).toBe(true);
  });

  it("refuses a redirect chain that ends at the metadata address", async () => {
    const preview = await fetchLinkPreview("http://1.1.1.1/start", async (url) => {
      if (url === "http://1.1.1.1/start") {
        return pageResponse("", 302, "http://8.8.8.8/next");
      }
      if (url === "http://8.8.8.8/next") {
        return pageResponse("", 302, "http://169.254.169.254/latest/meta-data/");
      }
      return pageResponse('<meta property="og:title" content="secret">');
    });
    expect(preview).toBeNull();
  });

  it("follows a public redirect and reads the open graph tags", async () => {
    const preview = await fetchLinkPreview("http://1.1.1.1/start", async (url) => {
      if (url === "http://1.1.1.1/start") {
        return pageResponse("", 302, "http://8.8.8.8/page");
      }
      return pageResponse(savedHtml.replace('content="/cover.png"', 'content="http://8.8.8.8/cover.png"'));
    });
    expect(preview).toEqual({
      ...savedPreview,
      image_url: "http://8.8.8.8/cover.png",
    });
  });

  it("keeps a title in the first megabyte and drops a title after it", async () => {
    const padding = "x".repeat(1024 * 1024 + 50);
    const early = await fetchLinkPreview("http://1.1.1.1/long", async () => {
      return pageResponse(`<meta property="og:title" content="early">${padding}`);
    });
    expect(early?.title).toBe("early");

    const late = await fetchLinkPreview("http://1.1.1.1/late", async () => {
      return pageResponse(`${padding}<meta property="og:title" content="late">`);
    });
    expect(late).toBeNull();
  });
});

describe("link preview on items", () => {
  it("saves http://127.0.0.1/ with an empty preview", async () => {
    const created = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: "http://127.0.0.1/",
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      type: "link",
      content: "http://127.0.0.1/",
      status: "inbox",
      link_preview: null,
    });
  });

  it("stores the preview on the item and hides it from the other user", async () => {
    vi.stubGlobal("fetch", async () => pageResponse(savedHtml));
    const created = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: "http://1.1.1.1/page",
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      type: "link",
      content: "http://1.1.1.1/page",
      link_preview: savedPreview,
    });

    const loaded = await request(app).get(`/items/${created.body.id}`).set("Cookie", cookiesA);
    expect(loaded.status).toBe(200);
    expect(loaded.body.link_preview).toEqual(savedPreview);

    const asB = await request(app).get(`/items/${created.body.id}`).set("Cookie", cookiesB);
    expect(asB.status).toBe(404);
    expect(asB.body).toEqual({ error: "مش موجود" });
  });

  it("fills the preview again when the URL changes", async () => {
    const created = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: "http://127.0.0.1/old",
    });
    expect(created.status).toBe(201);
    expect(created.body.link_preview).toBeNull();

    vi.stubGlobal("fetch", async () => pageResponse(savedHtml));
    const patched = await request(app)
      .patch(`/items/${created.body.id}`)
      .set("Cookie", cookiesA)
      .send({ content: "http://1.1.1.1/page" });
    expect(patched.status).toBe(200);
    expect(patched.body.content).toBe("http://1.1.1.1/page");
    expect(patched.body.link_preview).toEqual(savedPreview);
  });

  it("saves a public link even when the page has no preview", async () => {
    const created = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: "https://example.com/preview-check",
    });
    expect(created.status).toBe(201);
    expect(created.body.content).toBe("https://example.com/preview-check");
    const preview = created.body.link_preview;
    if (preview !== null) {
      expect(linkPreviewSchema.safeParse(preview).success).toBe(true);
    }
  }, 20000);
});
