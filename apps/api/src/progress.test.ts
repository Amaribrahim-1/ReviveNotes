import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./db.js";
import { getUserDayRange } from "./user-day.js";

const password = "password-ok";
const emails: string[] = [];

let cookiesA = "";
let cookiesB = "";
let userAId = "";

function nextEmail(label: string): string {
  const email = `t11-${label}-${randomUUID()}@example.com`;
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

async function createText(cookies: string, content: string): Promise<string> {
  const created = await request(app).post("/items").set("Cookie", cookies).send({
    type: "text",
    content,
  });
  expect(created.status).toBe(201);
  return created.body.id as string;
}

async function readProgress(cookies: string): Promise<{ cleared: number; open: number }> {
  const response = await request(app).get("/progress/today").set("Cookie", cookies);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ cleared: expect.any(Number), open: expect.any(Number) });
  return response.body as { cleared: number; open: number };
}

beforeAll(async () => {
  const createdA = await postRegister(nextEmail("a"));
  const createdB = await postRegister(nextEmail("b"));
  expect(createdA.status).toBe(201);
  expect(createdB.status).toBe(201);
  cookiesA = cookieHeader(createdA);
  cookiesB = cookieHeader(createdB);
  userAId = createdA.body.id as string;
});

afterAll(async () => {
  if (emails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
  }
});

describe("GET /progress/today", () => {
  it("counts today's done event and drops it when the item leaves done", async () => {
    const before = await readProgress(cookiesA);
    const itemId = await createText(cookiesA, "خلصت النهاردة");

    const done = await request(app).patch(`/items/${itemId}`).set("Cookie", cookiesA).send({ status: "done" });
    expect(done.status).toBe(200);
    expect(await readProgress(cookiesA)).toEqual({ cleared: before.cleared + 1, open: before.open });

    const back = await request(app).patch(`/items/${itemId}`).set("Cookie", cookiesA).send({ status: "inbox" });
    expect(back.status).toBe(200);
    expect(await readProgress(cookiesA)).toEqual({ cleared: before.cleared, open: before.open + 1 });
  });

  it("does not count a deleted item, even one that was done today", async () => {
    const before = await readProgress(cookiesA);
    const openId = await createText(cookiesA, "هتتحذف النهاردة");
    const doneId = await createText(cookiesA, "خلصت وبعدين اتحذفت");

    const done = await request(app).patch(`/items/${doneId}`).set("Cookie", cookiesA).send({ status: "done" });
    expect(done.status).toBe(200);
    expect(await readProgress(cookiesA)).toEqual({ cleared: before.cleared + 1, open: before.open + 1 });

    const deletedOpen = await request(app).delete(`/items/${openId}`).set("Cookie", cookiesA);
    expect(deletedOpen.status).toBe(204);
    const deletedDone = await request(app).delete(`/items/${doneId}`).set("Cookie", cookiesA);
    expect(deletedDone.status).toBe(204);

    const stored = await prisma.item.findMany({
      where: { id: { in: [openId, doneId] } },
      select: { id: true },
    });
    expect(stored).toEqual([]);
    expect(await readProgress(cookiesA)).toEqual(before);
  });

  it("does not count an archived item", async () => {
    const before = await readProgress(cookiesA);
    const itemId = await createText(cookiesA, "للأرشيف");

    const archived = await request(app)
      .patch(`/items/${itemId}`)
      .set("Cookie", cookiesA)
      .send({ status: "archived" });
    expect(archived.status).toBe(200);

    const events = await prisma.clearEvent.findMany({
      where: { item_id: itemId },
    });
    expect(events).toEqual([]);
    expect(await readProgress(cookiesA)).toEqual(before);
  });



  it("keeps user B at 0 when user A clears an item", async () => {
    const beforeB = await readProgress(cookiesB);
    expect(beforeB).toEqual({ cleared: 0, open: 0 });

    const beforeA = await readProgress(cookiesA);
    const itemId = await createText(cookiesA, "ملاحظة أ");
    const done = await request(app).patch(`/items/${itemId}`).set("Cookie", cookiesA).send({ status: "done" });
    expect(done.status).toBe(200);

    expect(await readProgress(cookiesA)).toEqual({ cleared: beforeA.cleared + 1, open: beforeA.open });
    expect(await readProgress(cookiesB)).toEqual({ cleared: 0, open: 0 });
  });

  it("rejects a caller with no session", async () => {
    const response = await request(app).get("/progress/today");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "لازم تسجل دخول" });
  });
});
