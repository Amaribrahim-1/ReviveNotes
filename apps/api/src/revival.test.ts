import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { app } from "./app.js";
import { prisma } from "./db.js";

const password = "password-ok";
const emails: string[] = [];
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

let cookiesA = "";
let cookiesB = "";

function nextEmail(label: string): string {
  const email = `t9-${label}-${randomUUID()}@example.com`;
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
  status: string;
  created_at: string;
  last_touched_at: string;
};

type RevivalBody = {
  items: ItemBody[];
};

async function createText(cookies: string, content: string): Promise<ItemBody> {
  const created = await request(app).post("/items").set("Cookie", cookies).send({
    type: "text",
    content,
  });
  expect(created.status).toBe(201);
  return created.body as ItemBody;
}

async function setStatus(cookies: string, id: string, status: string): Promise<void> {
  const patched = await request(app).patch(`/items/${id}`).set("Cookie", cookies).send({ status });
  expect(patched.status).toBe(200);
}

async function setTouched(id: string, touchedAt: Date): Promise<void> {
  await prisma.item.update({
    where: { id },
    data: { last_touched_at: touchedAt },
  });
}

function idsOf(body: RevivalBody): string[] {
  return body.items.map((item) => item.id);
}

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

describe("revival", () => {
  it("includes an item one millisecond past 7 days and leaves the cutoff out", async () => {
    const exact = await createText(cookiesA, "على الحد");
    const stale = await createText(cookiesA, "أقدم بميلي ثانية");
    const fresh = await createText(cookiesA, "أحدث بميلي ثانية");
    const frozen = new Date();
    const exactTouch = new Date(frozen.getTime() - SEVEN_DAYS_MS);
    const staleTouch = new Date(frozen.getTime() - SEVEN_DAYS_MS - 1);
    const freshTouch = new Date(frozen.getTime() - SEVEN_DAYS_MS + 1);
    await setTouched(exact.id, exactTouch);
    await setTouched(stale.id, staleTouch);
    await setTouched(fresh.id, freshTouch);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(frozen);
    try {
      const listed = await request(app).get("/revival").set("Cookie", cookiesA);
      expect(listed.status).toBe(200);
      const ids = idsOf(listed.body as RevivalBody);
      expect(ids).toContain(stale.id);
      expect(ids).not.toContain(exact.id);
      expect(ids).not.toContain(fresh.id);
    } finally {
      vi.useRealTimers();
    }

    const stored = await prisma.item.findFirst({
      where: { id: stale.id },
      select: { last_touched_at: true },
    });
    expect(stored?.last_touched_at.getTime()).toBe(staleTouch.getTime());
  });

  it("lists old inbox and active items, oldest first, and skips done and archived", async () => {
    const inbox = await createText(cookiesA, "وارد قديم");
    const active = await createText(cookiesA, "شغال قديم");
    const done = await createText(cookiesA, "خلصت");
    const archived = await createText(cookiesA, "أرشيف");
    const recent = await createText(cookiesA, "لسه جديد");
    await setStatus(cookiesA, active.id, "active");
    await setStatus(cookiesA, done.id, "done");
    await setStatus(cookiesA, archived.id, "archived");

    const older = new Date(Date.now() - 9 * 24 * 60 * 60 * 1000);
    const old = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await setTouched(active.id, older);
    await setTouched(inbox.id, old);
    await setTouched(done.id, older);
    await setTouched(archived.id, older);

    const listed = await request(app).get("/revival").set("Cookie", cookiesA);
    expect(listed.status).toBe(200);
    const ids = idsOf(listed.body as RevivalBody);
    expect(ids).toContain(inbox.id);
    expect(ids).toContain(active.id);
    expect(ids.indexOf(active.id)).toBeLessThan(ids.indexOf(inbox.id));
    expect(ids).not.toContain(done.id);
    expect(ids).not.toContain(archived.id);
    expect(ids).not.toContain(recent.id);
  });

  it("revive moves last_touched_at and leaves created_at and status", async () => {
    const item = await createText(cookiesA, "هتتحيى");
    await setStatus(cookiesA, item.id, "active");
    const touchedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await setTouched(item.id, touchedAt);

    const revived = await request(app).post(`/items/${item.id}/revive`).set("Cookie", cookiesA);
    expect(revived.status).toBe(200);
    const body = revived.body as ItemBody;
    expect(body.status).toBe("active");
    expect(body.created_at).toBe(item.created_at);
    expect(body.last_touched_at).not.toBe(touchedAt.toISOString());

    const stored = await prisma.item.findFirst({
      where: { id: item.id },
      select: { status: true, created_at: true, last_touched_at: true },
    });
    expect(stored?.status).toBe("active");
    expect(stored?.created_at.toISOString()).toBe(item.created_at);
    expect(stored?.last_touched_at.toISOString()).toBe(body.last_touched_at);

    const listed = await request(app).get("/revival").set("Cookie", cookiesA);
    expect(listed.status).toBe(200);
    expect(idsOf(listed.body as RevivalBody)).not.toContain(item.id);
  });

  it("gives another user an empty list and 404 on revive", async () => {
    const item = await createText(cookiesA, "بتاعت أ");
    const touchedAt = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
    await setTouched(item.id, touchedAt);

    const listed = await request(app).get("/revival").set("Cookie", cookiesB);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ items: [] });

    const revived = await request(app).post(`/items/${item.id}/revive`).set("Cookie", cookiesB);
    expect(revived.status).toBe(404);

    const stored = await prisma.item.findFirst({
      where: { id: item.id },
      select: { last_touched_at: true },
    });
    expect(stored?.last_touched_at.getTime()).toBe(touchedAt.getTime());
  });
});
