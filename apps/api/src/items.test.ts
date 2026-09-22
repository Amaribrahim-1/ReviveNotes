import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./db.js";

const password = "password-ok";
const emails: string[] = [];

let cookiesA = "";
let cookiesB = "";

function nextEmail(label: string): string {
  const email = `t4-${label}-${randomUUID()}@example.com`;
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
  status: string;
  category_id: string | null;
  link_preview: null;
  created_at: string;
  last_touched_at: string;
};

type ItemPageBody = {
  items: ItemBody[];
  next_cursor: string | null;
};

beforeAll(async () => {
  const createdA = await postRegister(nextEmail("a"));
  const createdB = await postRegister(nextEmail("b"));
  expect(createdA.status).toBe(201);
  expect(createdB.status).toBe(201);
  cookiesA = cookieHeader(createdA);
  cookiesB = cookieHeader(createdB);
});

afterAll(async () => {
  if (emails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
  }
});

describe("text and link items", () => {
  it.each([
    ["get", "/items"],
    ["post", "/items"],
    ["get", "/items/missing"],
    ["patch", "/items/missing"],
    ["delete", "/items/missing"],
  ] as const)("%s %s without a session returns 401", async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "لازم تسجل دخول" });
  });

  it("creates a trimmed text note in the inbox", async () => {
    const created = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "text",
      content: "  سطر أول\nسطر تاني  ",
    });
    expect(created.status).toBe(201);
    const body = created.body as ItemBody;
    expect(body).toMatchObject({
      type: "text",
      content: "سطر أول\nسطر تاني",
      status: "inbox",
      category_id: null,
      link_preview: null,
    });
    expect(body.last_touched_at).toBe(body.created_at);

    const loaded = await request(app).get(`/items/${body.id}`).set("Cookie", cookiesA);
    expect(loaded.status).toBe(200);
    expect(loaded.body).toEqual(body);

    const listed = await request(app).get("/items").query({ status: "inbox" }).set("Cookie", cookiesA);
    expect(listed.status).toBe(200);
    const page = listed.body as ItemPageBody;
    expect(page.items.find((item) => item.id === body.id)).toEqual(body);

    const stored = await prisma.item.findFirst({
      where: { id: body.id },
      select: { created_at: true, last_touched_at: true },
    });
    expect(stored?.created_at.toISOString()).toBe(body.created_at);
    expect(stored?.last_touched_at.toISOString()).toBe(body.last_touched_at);
  });

  it("creates a trimmed link and leaves last_touched_at alone on read", async () => {
    const created = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: "  https://example.com/notes  ",
    });
    expect(created.status).toBe(201);
    const body = created.body as ItemBody;
    expect(body).toMatchObject({
      type: "link",
      content: "https://example.com/notes",
      status: "inbox",
      category_id: null,
      link_preview: null,
    });
    expect(body.last_touched_at).toBe(body.created_at);

    const loaded = await request(app).get(`/items/${body.id}`).set("Cookie", cookiesA);
    const listed = await request(app).get("/items").query({ status: "inbox" }).set("Cookie", cookiesA);
    expect(loaded.status).toBe(200);
    expect(loaded.body.last_touched_at).toBe(body.last_touched_at);

    const page = listed.body as ItemPageBody;
    const row = page.items.find((item) => item.id === body.id);
    expect(row?.last_touched_at).toBe(body.last_touched_at);

    const stored = await prisma.item.findFirst({
      where: { id: body.id },
      select: { last_touched_at: true },
    });
    expect(stored?.last_touched_at.toISOString()).toBe(body.last_touched_at);
  });

  it("rejects empty text, a huge note, a bad link, and voice", async () => {
    const empty = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "text",
      content: "   ",
    });
    expect(empty.status).toBe(400);
    expect(empty.body).toEqual({ error: "اكتب الملاحظة" });

    const huge = await request(app)
      .post("/items")
      .set("Cookie", cookiesA)
      .send({ type: "text", content: "ا".repeat(10001) });
    expect(huge.status).toBe(400);
    expect(huge.body).toEqual({ error: "الملاحظة أطول من 10000 حرف" });

    const badLink = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: "javascript:alert(1)",
    });
    expect(badLink.status).toBe(400);
    expect(badLink.body).toEqual({ error: "الرابط لازم يبدأ بـ http أو https" });

    const longLink = `https://example.com/${"a".repeat(1981)}`;
    expect(longLink.length).toBe(2001);
    const tooLong = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: longLink,
    });
    expect(tooLong.status).toBe(400);
    expect(tooLong.body).toEqual({ error: "الرابط أطول من 2000 حرف" });

    const voice = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "voice",
      content: "clip",
    });
    expect(voice.status).toBe(400);
    expect(voice.body).toEqual({ error: "اختار نص أو رابط" });
  });

  it("hides another user's item", async () => {
    const created = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "text",
      content: "ملاحظة خاصة",
    });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const asB = await request(app).get(`/items/${id}`).set("Cookie", cookiesB);
    expect(asB.status).toBe(404);
    expect(asB.body).toEqual({ error: "مش موجود" });

    const missing = await request(app).get("/items/missing-item").set("Cookie", cookiesA);
    expect(missing.status).toBe(404);

    const listB = await request(app).get("/items").query({ status: "inbox" }).set("Cookie", cookiesB);
    expect(listB.status).toBe(200);
    const page = listB.body as ItemPageBody;
    expect(page.items.map((item) => item.id)).not.toContain(id);

    const active = await request(app).get("/items").query({ status: "active" }).set("Cookie", cookiesA);
    expect(active.status).toBe(200);
    const activePage = active.body as ItemPageBody;
    expect(activePage.items.map((item) => item.id)).not.toContain(id);
  });

  it("returns 30 items and then the 31st", async () => {
    const registered = await postRegister(nextEmail("page"));
    expect(registered.status).toBe(201);
    const cookies = cookieHeader(registered);
    const ids: string[] = [];

    for (let index = 0; index < 31; index += 1) {
      const created = await request(app).post("/items").set("Cookie", cookies).send({
        type: "text",
        content: `note ${index}`,
      });
      expect(created.status).toBe(201);
      ids.push(created.body.id as string);
    }

    const first = await request(app).get("/items").query({ status: "inbox" }).set("Cookie", cookies);
    expect(first.status).toBe(200);
    const firstPage = first.body as ItemPageBody;
    expect(firstPage.items).toHaveLength(30);
    expect(firstPage.next_cursor).toBe(
      `${firstPage.items[29]?.created_at}|${firstPage.items[29]?.id}`,
    );

    const second = await request(app)
      .get("/items")
      .query({ status: "inbox", cursor: firstPage.next_cursor })
      .set("Cookie", cookies);
    expect(second.status).toBe(200);
    const secondPage = second.body as ItemPageBody;
    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.next_cursor).toBeNull();

    const combined = [...firstPage.items, ...secondPage.items];
    expect(combined.map((item) => item.id).sort()).toEqual([...ids].sort());

    for (let index = 1; index < combined.length; index += 1) {
      const previous = combined[index - 1];
      const current = combined[index];
      if (!previous || !current) {
        throw new Error("missing page row");
      }
      const inOrder =
        previous.created_at > current.created_at ||
        (previous.created_at === current.created_at && previous.id > current.id);
      expect(inOrder).toBe(true);
    }

    const badCursor = await request(app)
      .get("/items")
      .query({ status: "inbox", cursor: "not-a-cursor" })
      .set("Cookie", cookies);
    expect(badCursor.status).toBe(400);
    expect(badCursor.body).toEqual({ error: "المؤشر مش مفهوم" });
  });
});
