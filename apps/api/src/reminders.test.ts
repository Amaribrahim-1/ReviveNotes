import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const pushMock = vi.hoisted(() => {
  return {
    sendWebPush: vi.fn(async () => "sent" as const),
  };
});

vi.mock("./push-sender.js", () => {
  return { sendWebPush: pushMock.sendWebPush };
});

import { app } from "./app.js";
import { prisma } from "./db.js";
import { getUserDayRange, readLocalCalendar } from "./user-day.js";

const password = "password-ok";
const timezone = "Africa/Cairo";
const emails: string[] = [];

let cookiesA = "";
let cookiesB = "";
let userAId = "";

function nextEmail(label: string): string {
  const email = `t10-${label}-${randomUUID()}@example.com`;
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
    timezone,
  });
}

function currentSlot(): string {
  const calendar = readLocalCalendar(new Date(), timezone);
  const hour = String(calendar.hour).padStart(2, "0");
  const minute = String(calendar.minute).padStart(2, "0");
  return `${hour}:${minute}`;
}

function settingsBody(remindersEnabled: boolean, reminderTimes: string[]) {
  return {
    timezone,
    day_start_time: 23,
    reminders_enabled: remindersEnabled,
    reminder_times: reminderTimes,
  };
}

beforeAll(async () => {
  process.env.CRON_SECRET = "test-cron-secret";
  const createdA = await postRegister(nextEmail("a"));
  const createdB = await postRegister(nextEmail("b"));
  expect(createdA.status).toBe(201);
  expect(createdB.status).toBe(201);
  cookiesA = cookieHeader(createdA);
  cookiesB = cookieHeader(createdB);
  userAId = createdA.body.id as string;
});

beforeEach(() => {
  pushMock.sendWebPush.mockReset();
  pushMock.sendWebPush.mockResolvedValue("sent");
});

afterAll(async () => {
  if (emails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
  }
});

describe("reminders", () => {
  it("rejects 0 times and 4 times when reminders are enabled, and ignores times when disabled", async () => {
    const none = await request(app).patch("/me").set("Cookie", cookiesA).send(settingsBody(true, []));
    expect(none.status).toBe(400);
    expect(none.body).toEqual({ error: "اختار من 1 لـ 3 أوقات مختلفة" });

    const four = await request(app)
      .patch("/me")
      .set("Cookie", cookiesA)
      .send(settingsBody(true, ["08:00", "09:00", "10:00", "11:00"]));
    expect(four.status).toBe(400);
    expect(four.body).toEqual({ error: "اختار من 1 لـ 3 أوقات مختلفة" });

    const enabled = await request(app)
      .patch("/me")
      .set("Cookie", cookiesA)
      .send(settingsBody(true, ["09:00", "18:00"]));
    expect(enabled.status).toBe(200);
    expect(enabled.body).toMatchObject({
      reminders_enabled: true,
      reminder_times: ["09:00", "18:00"],
    });

    const disabled = await request(app)
      .patch("/me")
      .set("Cookie", cookiesA)
      .send(settingsBody(false, ["99:99", "99:99", "99:99", "99:99"]));
    expect(disabled.status).toBe(200);
    expect(disabled.body).toMatchObject({
      reminders_enabled: false,
      reminder_times: ["09:00", "18:00"],
    });
  });

  it("returns 404 when user B deletes user A's subscription", async () => {
    const created = await request(app).post("/push-subscriptions").set("Cookie", cookiesA).send({
      endpoint: "https://push.example.test/a",
      p256dh: "key-a",
      auth: "auth-a",
    });
    expect(created.status).toBe(201);
    const subscriptionId = created.body.id as string;

    const updated = await request(app).post("/push-subscriptions").set("Cookie", cookiesA).send({
      endpoint: "https://push.example.test/a",
      p256dh: "key-a",
      auth: "auth-b",
    });
    expect(updated.status).toBe(200);
    expect(updated.body).toEqual({ id: subscriptionId });

    const rows = await prisma.pushSubscription.findMany({
      where: { endpoint: "https://push.example.test/a" },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.auth).toBe("auth-b");

    const missing = await request(app).delete(`/push-subscriptions/${subscriptionId}`);
    expect(missing.status).toBe(401);

    const foreign = await request(app)
      .delete(`/push-subscriptions/${subscriptionId}`)
      .set("Cookie", cookiesB);
    expect(foreign.status).toBe(404);
    expect(foreign.body).toEqual({ error: "مش موجود" });

    const stillThere = await prisma.pushSubscription.findFirst({
      where: { id: subscriptionId, user_id: userAId },
    });
    expect(stillThere).not.toBeNull();

    const removed = await request(app)
      .delete(`/push-subscriptions/${subscriptionId}`)
      .set("Cookie", cookiesA);
    expect(removed.status).toBe(204);
  });

  it("rejects dispatch without the secret and does not write a second delivery for the same slot", async () => {
    const slot = currentSlot();
    const enabled = await request(app).patch("/me").set("Cookie", cookiesA).send(settingsBody(true, [slot]));
    expect(enabled.status).toBe(200);

    const inbox = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "text",
      content: "لسه مفتوحة",
    });
    expect(inbox.status).toBe(201);
    const doneItem = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "text",
      content: "خلصت",
    });
    expect(doneItem.status).toBe(201);
    const marked = await request(app)
      .patch(`/items/${doneItem.body.id as string}`)
      .set("Cookie", cookiesA)
      .send({ status: "done" });
    expect(marked.status).toBe(200);

    await prisma.pushSubscription.deleteMany({ where: { user_id: userAId } });
    await prisma.reminderDelivery.deleteMany({ where: { user_id: userAId } });
    const subscribed = await request(app).post("/push-subscriptions").set("Cookie", cookiesA).send({
      endpoint: "https://push.example.test/dispatch",
      p256dh: "key-dispatch",
      auth: "auth-dispatch",
    });
    expect(subscribed.status).toBe(201);

    const missing = await request(app).post("/reminders/dispatch");
    expect(missing.status).toBe(401);
    expect(missing.body).toEqual({ error: "السر مش صحيح" });

    const wrong = await request(app).post("/reminders/dispatch").set("x-cron-secret", "nope");
    expect(wrong.status).toBe(401);

    const first = await request(app).post("/reminders/dispatch").set("x-cron-secret", "test-cron-secret");
    expect(first.status).toBe(200);
    expect(first.text).toBe("OK");
    expect(pushMock.sendWebPush).toHaveBeenCalledTimes(1);
    expect(pushMock.sendWebPush).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://push.example.test/dispatch" }),
      "1",
    );

    const second = await request(app).post("/reminders/dispatch").set("x-cron-secret", "test-cron-secret");
    expect(second.status).toBe(200);
    expect(pushMock.sendWebPush).toHaveBeenCalledTimes(1);

    const deliveries = await prisma.reminderDelivery.findMany({
      where: { user_id: userAId, slot },
    });
    expect(deliveries).toHaveLength(1);

    const calendar = readLocalCalendar(new Date(), timezone);
    const storedDate = deliveries[0]?.local_date;
    expect(storedDate).toBeInstanceOf(Date);
    expect(utcDateText(storedDate as Date)).toBe(calendar.localDate);
    if (calendar.hour < 23) {
      expect(calendar.localDate).not.toBe(getUserDayRange(timezone, 23, new Date()).localDate);
    }

    await prisma.reminderDelivery.deleteMany({ where: { user_id: userAId, slot } });
    const retried = await request(app).post("/reminders/dispatch").set("x-cron-secret", "test-cron-secret");
    expect(retried.status).toBe(200);
    expect(pushMock.sendWebPush).toHaveBeenCalledTimes(2);
    const afterRetry = await prisma.reminderDelivery.findMany({
      where: { user_id: userAId, slot },
    });
    expect(afterRetry).toHaveLength(1);
  });

  it("does not write a delivery when the push send throws, then sends on the next tick", async () => {
    const slot = currentSlot();
    await request(app).patch("/me").set("Cookie", cookiesA).send(settingsBody(true, [slot]));
    await prisma.reminderDelivery.deleteMany({ where: { user_id: userAId } });
    await prisma.pushSubscription.deleteMany({ where: { user_id: userAId } });
    await request(app).post("/push-subscriptions").set("Cookie", cookiesA).send({
      endpoint: "https://push.example.test/throws",
      p256dh: "key-throws",
      auth: "auth-throws",
    });

    pushMock.sendWebPush.mockRejectedValueOnce(new Error("push down"));
    const failed = await request(app).post("/reminders/dispatch").set("x-cron-secret", "test-cron-secret");
    expect(failed.status).toBe(200);
    const none = await prisma.reminderDelivery.findMany({ where: { user_id: userAId, slot } });
    expect(none).toHaveLength(0);

    const again = await request(app).post("/reminders/dispatch").set("x-cron-secret", "test-cron-secret");
    expect(again.status).toBe(200);
    const written = await prisma.reminderDelivery.findMany({ where: { user_id: userAId, slot } });
    expect(written).toHaveLength(1);
  });

  it("deletes a subscription when the push service says it is gone", async () => {
    const slot = currentSlot();
    await request(app).patch("/me").set("Cookie", cookiesA).send(settingsBody(true, [slot]));
    await prisma.reminderDelivery.deleteMany({ where: { user_id: userAId } });
    await prisma.pushSubscription.deleteMany({ where: { user_id: userAId } });
    const subscribed = await request(app).post("/push-subscriptions").set("Cookie", cookiesA).send({
      endpoint: "https://push.example.test/gone",
      p256dh: "key-gone",
      auth: "auth-gone",
    });
    expect(subscribed.status).toBe(201);

    pushMock.sendWebPush.mockResolvedValueOnce("gone");
    const dispatched = await request(app).post("/reminders/dispatch").set("x-cron-secret", "test-cron-secret");
    expect(dispatched.status).toBe(200);

    const subscription = await prisma.pushSubscription.findFirst({
      where: { id: subscribed.body.id as string },
    });
    expect(subscription).toBeNull();
    const deliveries = await prisma.reminderDelivery.findMany({
      where: { user_id: userAId, slot },
    });
    expect(deliveries).toHaveLength(0);
  });
});

function utcDateText(value: Date): string {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
