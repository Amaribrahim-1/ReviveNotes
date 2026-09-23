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

async function readCleared(cookies: string): Promise<number> {
  const response = await request(app).get("/progress/today").set("Cookie", cookies);
  expect(response.status).toBe(200);
  expect(response.body).toEqual({ cleared: expect.any(Number) });
  return response.body.cleared as number;
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
    const before = await readCleared(cookiesA);
    const itemId = await createText(cookiesA, "خلصت النهاردة");

    const done = await request(app).patch(`/items/${itemId}`).set("Cookie", cookiesA).send({ status: "done" });
    expect(done.status).toBe(200);
    expect(await readCleared(cookiesA)).toBe(before + 1);

    const back = await request(app).patch(`/items/${itemId}`).set("Cookie", cookiesA).send({ status: "inbox" });
    expect(back.status).toBe(200);
    expect(await readCleared(cookiesA)).toBe(before);
  });

  it("counts a deleted event after the item row is gone", async () => {
    const before = await readCleared(cookiesA);
    const itemId = await createText(cookiesA, "هتتحذف النهاردة");

    const deleted = await request(app).delete(`/items/${itemId}`).set("Cookie", cookiesA);
    expect(deleted.status).toBe(204);

    const stored = await prisma.item.findFirst({
      where: { id: itemId },
      select: { id: true },
    });
    expect(stored).toBeNull();
    expect(await readCleared(cookiesA)).toBe(before + 1);
  });

  it("does not count an archived item", async () => {
    const before = await readCleared(cookiesA);
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
    expect(await readCleared(cookiesA)).toBe(before);
  });

  it("uses the user-day window, not the previous day and not the exclusive end", async () => {
    await prisma.user.update({
      where: { id: userAId },
      data: { day_start_time: 14 },
    });

    try {
      const user = await prisma.user.findUnique({
        where: { id: userAId },
        select: { timezone: true, day_start_time: true },
      });
      if (!user) {
        throw new Error("missing user");
      }

      const day = getUserDayRange(user.timezone, user.day_start_time, new Date());
      const itemId = await createText(cookiesA, "نافذة اليوم");
      const before = await readCleared(cookiesA);

      await prisma.clearEvent.create({
        data: {
          user_id: userAId,
          item_id: itemId,
          kind: "done",
          created_at: new Date(day.start.getTime() - 60_000),
        },
      });
      expect(await readCleared(cookiesA)).toBe(before);

      await prisma.clearEvent.create({
        data: {
          user_id: userAId,
          item_id: itemId,
          kind: "done",
          created_at: day.start,
        },
      });
      expect(await readCleared(cookiesA)).toBe(before + 1);

      await prisma.clearEvent.create({
        data: {
          user_id: userAId,
          item_id: itemId,
          kind: "done",
          created_at: day.end,
        },
      });
      expect(await readCleared(cookiesA)).toBe(before + 1);
    } finally {
      await prisma.user.update({
        where: { id: userAId },
        data: { day_start_time: 0 },
      });
    }
  });

  it("keeps user B at 0 when user A clears an item", async () => {
    const beforeB = await readCleared(cookiesB);
    expect(beforeB).toBe(0);

    const beforeA = await readCleared(cookiesA);
    const itemId = await createText(cookiesA, "ملاحظة أ");
    const done = await request(app).patch(`/items/${itemId}`).set("Cookie", cookiesA).send({ status: "done" });
    expect(done.status).toBe(200);

    expect(await readCleared(cookiesA)).toBe(beforeA + 1);
    expect(await readCleared(cookiesB)).toBe(0);
  });

  it("rejects a caller with no session", async () => {
    const response = await request(app).get("/progress/today");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "لازم تسجل دخول" });
  });
});
