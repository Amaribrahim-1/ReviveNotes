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

function nextEmail(label: string): string {
  const email = `t5-${label}-${randomUUID()}@example.com`;
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

describe("settings", () => {
  it("rejects hour 24 and a fake timezone, and leaves the saved settings alone", async () => {
    const missing = await request(app).patch("/me").send({
      timezone: "Africa/Cairo",
      day_start_time: 14,
    });
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: "لازم تسجل دخول" });

    const hour = await request(app).patch("/me").set("Cookie", cookiesA).send({
      timezone: "Africa/Cairo",
      day_start_time: 24,
    });
    expect(hour.status).toBe(400);
    expect(hour.body).toEqual({ error: "اختار ساعة من 0 لـ 23" });

    const zone = await request(app).patch("/me").set("Cookie", cookiesA).send({
      timezone: "Not/AZone",
      day_start_time: 14,
    });
    expect(zone.status).toBe(400);
    expect(zone.body).toEqual({ error: "المنطقة الزمنية مش صحيحة" });

    const me = await request(app).get("/me").set("Cookie", cookiesA);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({
      timezone: "Africa/Cairo",
      day_start_time: 0,
      reminders_enabled: false,
      reminder_times: [],
    });
  });

  it("does not change another user's timezone", async () => {
    const patched = await request(app).patch("/me").set("Cookie", cookiesB).send({
      timezone: "America/New_York",
      day_start_time: 5,
      reminders_enabled: true,
      reminder_times: ["09:00"],
    });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({
      timezone: "America/New_York",
      day_start_time: 5,
      reminders_enabled: false,
      reminder_times: [],
    });
    expect(patched.body.password_hash).toBeUndefined();

    const userA = await request(app).get("/me").set("Cookie", cookiesA);
    expect(userA.status).toBe(200);
    expect(userA.body).toMatchObject({
      timezone: "Africa/Cairo",
      day_start_time: 0,
    });

    const userB = await request(app).get("/me").set("Cookie", cookiesB);
    expect(userB.body).toMatchObject({
      timezone: "America/New_York",
      day_start_time: 5,
    });
  });

  it("adds local_date from the saved day start without changing created_at", async () => {
    const created = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "text",
      content: "ملاحظة اليوم",
    });
    expect(created.status).toBe(201);
    const itemId = created.body.id as string;
    const createdAt = created.body.created_at as string;

    const patched = await request(app).patch("/me").set("Cookie", cookiesA).send({
      timezone: "Africa/Cairo",
      day_start_time: 14,
    });
    expect(patched.status).toBe(200);
    expect(patched.body).toMatchObject({
      timezone: "Africa/Cairo",
      day_start_time: 14,
    });

    const listed = await request(app).get("/items").query({ status: "inbox" }).set("Cookie", cookiesA);
    expect(listed.status).toBe(200);
    const row = (listed.body.items as { id: string; local_date: string; created_at: string }[]).find(
      (item) => item.id === itemId,
    );
    expect(row?.created_at).toBe(createdAt);
    expect(row?.local_date).toBe(getUserDayRange("Africa/Cairo", 14, new Date(createdAt)).localDate);

    const stored = await prisma.item.findFirst({
      where: { id: itemId, user_id: patched.body.id as string },
      select: { created_at: true },
    });
    expect(stored?.created_at.toISOString()).toBe(createdAt);
  });
});
