import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { IMAGE_MAX_BYTES } from "@revivenotes/shared";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => {
  return {
    files: new Map<string, Buffer>(),
    failAfterWrite: false,
  };
});

vi.mock("./object-store.js", () => {
  return {
    putPrivateObject: async (key: string, body: Buffer) => {
      store.files.set(key, Buffer.from(body));
      if (store.failAfterWrite) {
        store.failAfterWrite = false;
        throw new Error("put failed");
      }
    },
    openPrivateObject: async (key: string) => {
      const found = store.files.get(key);
      if (!found) {
        throw new Error("missing object");
      }
      return Readable.from(found);
    },
    deletePrivateObject: async (key: string) => {
      store.files.delete(key);
    },
  };
});

import { app } from "./app.js";
import { prisma } from "./db.js";

const password = "password-ok";
const emails: string[] = [];

let cookiesA = "";
let cookiesB = "";
let userAId = "";

function nextEmail(label: string): string {
  const email = `t13-${label}-${randomUUID()}@example.com`;
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

type ImageBody = {
  id: string;
  type: string;
  content: string;
  status: string;
  category_id: string | null;
  duration_seconds: number | null;
  created_at: string;
  last_touched_at: string;
};

const imageKinds = [
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
] as const;

function postImage(cookies: string, bytes: Buffer, contentType: string) {
  const kind = imageKinds.find((entry) => entry[0] === contentType);
  const extension = kind?.[1] ?? "bin";
  return request(app)
    .post("/items/image")
    .set("Cookie", cookies)
    .attach("image", bytes, { filename: `photo.${extension}`, contentType });
}

beforeAll(async () => {
  const createdA = await postRegister(nextEmail("a"));
  const createdB = await postRegister(nextEmail("b"));
  expect(createdA.status).toBe(201);
  expect(createdB.status).toBe(201);
  cookiesA = cookieHeader(createdA);
  cookiesB = cookieHeader(createdB);
  userAId = (createdA.body as { id: string }).id;
});

beforeEach(() => {
  store.failAfterWrite = false;
});

afterAll(async () => {
  if (emails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
  }
});

describe("image items", () => {
  it("rejects an image upload without a session", async () => {
    const missingUpload = await request(app).post("/items/image");
    expect(missingUpload.status).toBe(401);
    expect(missingUpload.body).toEqual({ error: "لازم تسجل دخول" });
  });

  it.each(imageKinds)("stores a small %s and streams it without moving last_touched_at", async (contentType, extension) => {
    const bytes = Buffer.from(`${extension}-bytes`);
    const created = await postImage(cookiesA, bytes, contentType);
    expect(created.status).toBe(201);
    const body = created.body as ImageBody;
    expect(body).toMatchObject({
      type: "image",
      content: `${userAId}/${body.id}.${extension}`,
      status: "inbox",
      category_id: null,
      duration_seconds: null,
    });
    expect(body.content.includes("http")).toBe(false);
    expect(body.last_touched_at).toBe(body.created_at);

    const file = await request(app).get(`/items/${body.id}/file`).set("Cookie", cookiesA);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe(contentType);
    const streamed = Buffer.isBuffer(file.body) ? file.body : Buffer.from(file.body);
    expect(streamed.equals(bytes)).toBe(true);

    const loaded = await request(app).get(`/items/${body.id}`).set("Cookie", cookiesA);
    expect(loaded.status).toBe(200);
    expect((loaded.body as ImageBody).last_touched_at).toBe(body.last_touched_at);

    const stored = await prisma.item.findFirst({
      where: { id: body.id, user_id: userAId },
      select: { last_touched_at: true },
    });
    expect(stored?.last_touched_at.toISOString()).toBe(body.last_touched_at);
  });

  it("accepts an image of exactly 5 MB", async () => {
    const created = await postImage(cookiesA, Buffer.alloc(IMAGE_MAX_BYTES), "image/jpeg");
    expect(created.status).toBe(201);
    expect((created.body as ImageBody).type).toBe("image");
  }, 30_000);

  it("rejects a file over 5 MB and leaves no row and no object", async () => {
    const before = await prisma.item.count({ where: { user_id: userAId } });
    const objectsBefore = store.files.size;
    const tooBig = Buffer.alloc(IMAGE_MAX_BYTES + 1);
    const created = await postImage(cookiesA, tooBig, "image/jpeg");
    expect(created.status).toBe(400);
    expect(created.body).toEqual({ error: "الصورة أكبر من 5 ميجا" });
    const after = await prisma.item.count({ where: { user_id: userAId } });
    expect(after).toBe(before);
    expect(store.files.size).toBe(objectsBefore);
  }, 30_000);

  it("rejects a type that is not jpeg, png, webp, or gif and leaves no object", async () => {
    const before = await prisma.item.count({ where: { user_id: userAId } });
    const objectsBefore = store.files.size;
    const created = await postImage(cookiesA, Buffer.from("svg"), "image/svg+xml");
    expect(created.status).toBe(400);
    expect(created.body).toEqual({ error: "نوع الصورة لازم يكون jpeg أو png أو webp أو gif" });
    const after = await prisma.item.count({ where: { user_id: userAId } });
    expect(after).toBe(before);
    expect(store.files.size).toBe(objectsBefore);
  });

  it("rejects an empty image and leaves no row", async () => {
    const before = await prisma.item.count({ where: { user_id: userAId } });
    const created = await postImage(cookiesA, Buffer.alloc(0), "image/png");
    expect(created.status).toBe(400);
    expect(created.body).toEqual({ error: "الصورة فاضية" });
    const after = await prisma.item.count({ where: { user_id: userAId } });
    expect(after).toBe(before);
  });

  it("deletes the row and the object when the put fails after a write", async () => {
    store.failAfterWrite = true;
    const before = await prisma.item.count({ where: { user_id: userAId } });
    const objectsBefore = store.files.size;
    const created = await postImage(cookiesA, Buffer.from("will-fail"), "image/gif");
    expect(created.status).toBe(500);
    expect(created.body).toEqual({ error: "حصل خطأ في السيرفر" });
    const after = await prisma.item.count({ where: { user_id: userAId } });
    expect(after).toBe(before);
    expect(store.files.size).toBe(objectsBefore);
  });

  it("returns 404 to user B and no bytes", async () => {
    const created = await postImage(cookiesA, Buffer.from("private-photo"), "image/jpeg");
    expect(created.status).toBe(201);
    const body = created.body as ImageBody;

    const asB = await request(app).get(`/items/${body.id}/file`).set("Cookie", cookiesB);
    expect(asB.status).toBe(404);
    expect(asB.body).toEqual({ error: "مش موجود" });
    expect(asB.headers["content-type"]).not.toContain("image/");
  });
});
