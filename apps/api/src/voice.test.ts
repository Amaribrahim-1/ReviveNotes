import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import { VOICE_MAX_BYTES } from "@revivenotes/shared";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => {
  return {
    files: new Map<string, Buffer>(),
    failPut: false,
  };
});

vi.mock("./object-store.js", () => {
  return {
    putPrivateObject: async (key: string, body: Buffer) => {
      if (store.failPut) {
        store.failPut = false;
        throw new Error("put failed");
      }
      store.files.set(key, Buffer.from(body));
    },
    openPrivateObject: async (key: string) => {
      const found = store.files.get(key);
      if (!found) {
        throw new Error("missing object");
      }
      return Readable.from(found);
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
  const email = `t8-${label}-${randomUUID()}@example.com`;
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

type VoiceBody = {
  id: string;
  type: string;
  content: string;
  status: string;
  category_id: string | null;
  duration_seconds: number | null;
  created_at: string;
  last_touched_at: string;
};

function postVoice(cookies: string, clip: Buffer, duration: string, contentType = "audio/webm") {
  const filename = contentType.startsWith("audio/ogg") ? "clip.ogg" : "clip.webm";
  return request(app)
    .post("/items/voice")
    .set("Cookie", cookies)
    .field("duration_seconds", duration)
    .attach("audio", clip, { filename, contentType });
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
  store.failPut = false;
});

afterAll(async () => {
  if (emails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
  }
});

describe("voice items", () => {
  it("rejects voice routes without a session", async () => {
    const missingUpload = await request(app).post("/items/voice");
    expect(missingUpload.status).toBe(401);
    expect(missingUpload.body).toEqual({ error: "لازم تسجل دخول" });

    const missingFile = await request(app).get("/items/missing/file");
    expect(missingFile.status).toBe(401);
    expect(missingFile.body).toEqual({ error: "لازم تسجل دخول" });
  });

  it("stores one clip and streams it without moving last_touched_at", async () => {
    const clip = Buffer.from("webm-bytes");
    const created = await postVoice(cookiesA, clip, "12", "audio/webm;codecs=opus");
    expect(created.status).toBe(201);
    const body = created.body as VoiceBody;
    expect(body).toMatchObject({
      type: "voice",
      content: `${userAId}/${body.id}.webm`,
      status: "inbox",
      category_id: null,
      duration_seconds: 12,
    });
    expect(body.content.includes("http")).toBe(false);
    expect(body.last_touched_at).toBe(body.created_at);

    const file = await request(app).get(`/items/${body.id}/file`).set("Cookie", cookiesA);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("audio/webm");
    const bytes = Buffer.isBuffer(file.body) ? file.body : Buffer.from(file.body);
    expect(bytes.equals(clip)).toBe(true);

    const loaded = await request(app).get(`/items/${body.id}`).set("Cookie", cookiesA);
    expect(loaded.status).toBe(200);
    expect((loaded.body as VoiceBody).last_touched_at).toBe(body.last_touched_at);

    const stored = await prisma.item.findFirst({
      where: { id: body.id, user_id: userAId },
      select: { last_touched_at: true },
    });
    expect(stored?.last_touched_at.toISOString()).toBe(body.last_touched_at);
  });

  it.each(["0", "600"])("accepts duration %s", async (duration) => {
    const created = await postVoice(cookiesA, Buffer.from("short"), duration);
    expect(created.status).toBe(201);
    expect((created.body as VoiceBody).duration_seconds).toBe(Number(duration));
  });

  it("stores an ogg clip under an ogg key", async () => {
    const created = await postVoice(cookiesA, Buffer.from("ogg-bytes"), "3", "audio/ogg");
    expect(created.status).toBe(201);
    const body = created.body as VoiceBody;
    expect(body.content).toBe(`${userAId}/${body.id}.ogg`);

    const file = await request(app).get(`/items/${body.id}/file`).set("Cookie", cookiesA);
    expect(file.status).toBe(200);
    expect(file.headers["content-type"]).toBe("audio/ogg");
  });

  it("rejects a body over 15 MB and leaves no row", async () => {
    const before = await prisma.item.count({ where: { user_id: userAId } });
    const tooBig = Buffer.alloc(VOICE_MAX_BYTES + 1);
    const created = await postVoice(cookiesA, tooBig, "4");
    expect(created.status).toBe(400);
    expect(created.body).toEqual({ error: "التسجيل أكبر من 15 ميجا" });
    const after = await prisma.item.count({ where: { user_id: userAId } });
    expect(after).toBe(before);
  }, 30_000);

  it("rejects a duration over 600 seconds and leaves no row", async () => {
    const before = await prisma.item.count({ where: { user_id: userAId } });
    const created = await postVoice(cookiesA, Buffer.from("too-long"), "601");
    expect(created.status).toBe(400);
    expect(created.body).toEqual({ error: "التسجيل أطول من 10 دقايق" });
    const after = await prisma.item.count({ where: { user_id: userAId } });
    expect(after).toBe(before);
  });

  it("rejects an empty clip and leaves no row", async () => {
    const before = await prisma.item.count({ where: { user_id: userAId } });
    const created = await postVoice(cookiesA, Buffer.alloc(0), "1");
    expect(created.status).toBe(400);
    expect(created.body).toEqual({ error: "التسجيل فاضي" });
    const after = await prisma.item.count({ where: { user_id: userAId } });
    expect(after).toBe(before);
  });

  it("rejects a type that is not webm or ogg", async () => {
    const before = await prisma.item.count({ where: { user_id: userAId } });
    const created = await postVoice(cookiesA, Buffer.from("mpeg"), "1", "audio/mpeg");
    expect(created.status).toBe(400);
    expect(created.body).toEqual({ error: "نوع التسجيل لازم يكون webm أو ogg" });
    const after = await prisma.item.count({ where: { user_id: userAId } });
    expect(after).toBe(before);
  });

  it("deletes the row when the object store rejects the put", async () => {
    store.failPut = true;
    const before = await prisma.item.count({ where: { user_id: userAId } });
    const created = await postVoice(cookiesA, Buffer.from("will-fail"), "2");
    expect(created.status).toBe(500);
    expect(created.body).toEqual({ error: "حصل خطأ في السيرفر" });
    const after = await prisma.item.count({ where: { user_id: userAId } });
    expect(after).toBe(before);
  });

  it("returns 404 to user B and no bytes", async () => {
    const created = await postVoice(cookiesA, Buffer.from("private-clip"), "8");
    expect(created.status).toBe(201);
    const body = created.body as VoiceBody;

    const asB = await request(app).get(`/items/${body.id}/file`).set("Cookie", cookiesB);
    expect(asB.status).toBe(404);
    expect(asB.body).toEqual({ error: "مش موجود" });
    expect(asB.headers["content-type"]).not.toContain("audio/");
  });
});
