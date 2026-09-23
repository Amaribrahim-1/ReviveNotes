import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => {
  return {
    files: new Map<string, Buffer>(),
  };
});

vi.mock("./object-store.js", () => {
  return {
    putPrivateObject: async (key: string, body: Buffer) => {
      store.files.set(key, Buffer.from(body));
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
  const email = `t15-${label}-${randomUUID()}@example.com`;
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

type ItemBody = {
  id: string;
  type: string;
  content: string;
  note: string | null;
  link_preview: unknown;
  created_at: string;
  last_touched_at: string;
};

async function backdateTouch(id: string): Promise<Date> {
  const touchedAt = new Date("2020-01-01T00:00:00.000Z");
  await prisma.item.update({
    where: { id },
    data: { last_touched_at: touchedAt },
  });
  return touchedAt;
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

afterAll(async () => {
  if (emails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
  }
});

describe("item note", () => {
  it("stores a trimmed note next to a link, an image, and a voice clip", async () => {
    const link = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: "https://example.com/with-note",
      note: "  اقرأ ده بعدين  ",
    });
    expect(link.status).toBe(201);
    const linkBody = link.body as ItemBody;
    expect(linkBody.content).toBe("https://example.com/with-note");
    expect(linkBody.note).toBe("اقرأ ده بعدين");

    const image = await request(app)
      .post("/items/image")
      .set("Cookie", cookiesA)
      .field("note", "  صورة المطبخ  ")
      .attach("image", Buffer.from("photo-bytes"), { filename: "photo.jpg", contentType: "image/jpeg" });
    expect(image.status).toBe(201);
    const imageBody = image.body as ItemBody;
    expect(imageBody.content).toBe(`${userAId}/${imageBody.id}.jpg`);
    expect(imageBody.note).toBe("صورة المطبخ");

    const voice = await request(app)
      .post("/items/voice")
      .set("Cookie", cookiesA)
      .field("duration_seconds", "4")
      .field("note", "  فكر في المكالمة  ")
      .attach("audio", Buffer.from("webm-bytes"), { filename: "clip.webm", contentType: "audio/webm" });
    expect(voice.status).toBe(201);
    const voiceBody = voice.body as ItemBody;
    expect(voiceBody.content).toBe(`${userAId}/${voiceBody.id}.webm`);
    expect(voiceBody.note).toBe("فكر في المكالمة");
  });

  it("stores a blank note as null", async () => {
    const missing = await request(app)
      .post("/items/image")
      .set("Cookie", cookiesA)
      .attach("image", Buffer.from("no-note"), { filename: "photo.png", contentType: "image/png" });
    expect(missing.status).toBe(201);
    expect((missing.body as ItemBody).note).toBeNull();

    const spaces = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: "https://example.com/blank-note",
      note: "   ",
    });
    expect(spaces.status).toBe(201);
    expect((spaces.body as ItemBody).note).toBeNull();
  });

  it("patches a note without changing content or link_preview", async () => {
    const created = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: "https://example.com/keep-url",
      note: "قديم",
    });
    expect(created.status).toBe(201);
    const item = created.body as ItemBody;
    const preview = {
      site_name: "Example",
      title: "Keep me",
      description: "Stay",
      image_url: "https://example.com/keep.png",
    };
    await prisma.item.update({
      where: { id: item.id },
      data: { link_preview: preview },
    });
    const touchedAt = await backdateTouch(item.id);

    const patched = await request(app).patch(`/items/${item.id}`).set("Cookie", cookiesA).send({
      note: "  جديد  ",
    });
    expect(patched.status).toBe(200);
    const body = patched.body as ItemBody;
    expect(body.note).toBe("جديد");
    expect(body.content).toBe("https://example.com/keep-url");
    expect(body.link_preview).toEqual(preview);
    expect(body.last_touched_at).not.toBe(touchedAt.toISOString());
    expect(body.created_at).toBe(item.created_at);

    const loaded = await request(app).get(`/items/${item.id}`).set("Cookie", cookiesA);
    expect(loaded.status).toBe(200);
    expect((loaded.body as ItemBody).last_touched_at).toBe(body.last_touched_at);

    const cleared = await request(app).patch(`/items/${item.id}`).set("Cookie", cookiesA).send({
      note: "",
    });
    expect(cleared.status).toBe(200);
    expect((cleared.body as ItemBody).note).toBeNull();
    expect((cleared.body as ItemBody).content).toBe("https://example.com/keep-url");
  });

  it("returns 404 when user B reads or patches user A's note", async () => {
    const created = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: "https://example.com/private-note",
      note: "خاص",
    });
    expect(created.status).toBe(201);
    const item = created.body as ItemBody;

    const loaded = await request(app).get(`/items/${item.id}`).set("Cookie", cookiesB);
    expect(loaded.status).toBe(404);
    expect(loaded.body).toEqual({ error: "مش موجود" });

    const patched = await request(app).patch(`/items/${item.id}`).set("Cookie", cookiesB).send({
      note: "اختراق",
    });
    expect(patched.status).toBe(404);
    expect(patched.body).toEqual({ error: "مش موجود" });

    const stored = await prisma.item.findFirst({
      where: { id: item.id },
      select: { note: true },
    });
    expect(stored?.note).toBe("خاص");
  });
});
