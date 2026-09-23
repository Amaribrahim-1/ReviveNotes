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
  const email = `t6-${label}-${randomUUID()}@example.com`;
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
  content: string;
  status: string;
  category_id: string | null;
  tag_ids: string[];
  link_preview: unknown;
  created_at: string;
  last_touched_at: string;
};

async function createText(cookies: string, content: string): Promise<ItemBody> {
  const created = await request(app).post("/items").set("Cookie", cookies).send({
    type: "text",
    content,
  });
  expect(created.status).toBe(201);
  return created.body as ItemBody;
}

function patchItem(cookies: string, id: string, body: Record<string, unknown>) {
  return request(app).patch(`/items/${id}`).set("Cookie", cookies).send(body);
}

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
  userAId = createdA.body.id as string;
});

afterAll(async () => {
  if (emails.length > 0) {
    await prisma.user.deleteMany({
      where: { email: { in: emails } },
    });
  }
});

describe("item lifecycle", () => {
  it("moves an item through every status and keeps created_at", async () => {
    const item = await createText(cookiesA, "دورة الحالة");
    const statuses = ["active", "done", "archived", "inbox"] as const;

    let current = item;
    for (const status of statuses) {
      const patched = await patchItem(cookiesA, item.id, { status });
      expect(patched.status).toBe(200);
      current = patched.body as ItemBody;
      expect(current.status).toBe(status);
      expect(current.created_at).toBe(item.created_at);
    }

    const stored = await prisma.item.findFirst({
      where: { id: item.id },
      select: { status: true, created_at: true },
    });
    expect(stored?.status).toBe("inbox");
    expect(stored?.created_at.toISOString()).toBe(item.created_at);
  });

  it("inserts one done event and does not insert another while the item stays done", async () => {
    const item = await createText(cookiesA, "خلصت مرة");
    const first = await patchItem(cookiesA, item.id, { status: "done" });
    expect(first.status).toBe(200);

    const edited = await patchItem(cookiesA, item.id, {
      status: "done",
      content: "خلصت ولسه خلصت",
    });
    expect(edited.status).toBe(200);
    expect((edited.body as ItemBody).status).toBe("done");

    const events = await prisma.clearEvent.findMany({
      where: { item_id: item.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0]?.kind).toBe("done");
    expect(events[0]?.user_id).toBe(userAId);

    const user = await prisma.user.findUnique({
      where: { id: userAId },
      select: { timezone: true, day_start_time: true },
    });
    if (!user || !events[0]) {
      throw new Error("missing user or done event");
    }
    const day = getUserDayRange(user.timezone, user.day_start_time, events[0].created_at);
    expect(events[0].created_at.getTime()).toBeGreaterThanOrEqual(day.start.getTime());
    expect(events[0].created_at.getTime()).toBeLessThan(day.end.getTime());
  });

  it("removes today's done event when leaving done and keeps an older one", async () => {
    await prisma.user.update({
      where: { id: userAId },
      data: { day_start_time: 14 },
    });

    try {
      const item = await createText(cookiesA, "حدث قديم");
      const user = await prisma.user.findUnique({
        where: { id: userAId },
        select: { timezone: true, day_start_time: true },
      });
      if (!user) {
        throw new Error("missing user");
      }

      const now = new Date();
      const day = getUserDayRange(user.timezone, user.day_start_time, now);
      const olderAt = new Date(day.start.getTime() - 60_000);
      const todayAt = new Date(day.start.getTime() + 60_000);

      await prisma.item.update({
        where: { id: item.id },
        data: { status: "done" },
      });
      await prisma.clearEvent.create({
        data: {
          user_id: userAId,
          item_id: item.id,
          kind: "done",
          created_at: olderAt,
        },
      });
      await prisma.clearEvent.create({
        data: {
          user_id: userAId,
          item_id: item.id,
          kind: "done",
          created_at: todayAt,
        },
      });

      const patched = await patchItem(cookiesA, item.id, { status: "inbox" });
      expect(patched.status).toBe(200);
      expect((patched.body as ItemBody).status).toBe("inbox");

      const events = await prisma.clearEvent.findMany({
        where: { item_id: item.id },
        orderBy: { created_at: "asc" },
      });
      expect(events).toHaveLength(1);
      expect(events[0]?.kind).toBe("done");
      expect(events[0]?.created_at.toISOString()).toBe(olderAt.toISOString());
    } finally {
      await prisma.user.update({
        where: { id: userAId },
        data: { day_start_time: 0 },
      });
    }
  });

  it("writes no event when an inbox item is archived", async () => {
    const item = await createText(cookiesA, "للأرشيف");
    const patched = await patchItem(cookiesA, item.id, { status: "archived" });
    expect(patched.status).toBe(200);
    expect((patched.body as ItemBody).status).toBe("archived");

    const events = await prisma.clearEvent.findMany({
      where: { item_id: item.id },
    });
    expect(events).toEqual([]);

    const stored = await prisma.item.findFirst({
      where: { id: item.id },
      select: { id: true },
    });
    expect(stored?.id).toBe(item.id);
  });

  it("drops today's done event when archiving and writes nothing new", async () => {
    const item = await createText(cookiesA, "خلصت ثم أرشيف");
    const done = await patchItem(cookiesA, item.id, { status: "done" });
    expect(done.status).toBe(200);

    const archived = await patchItem(cookiesA, item.id, { status: "archived" });
    expect(archived.status).toBe(200);
    expect((archived.body as ItemBody).status).toBe("archived");

    const events = await prisma.clearEvent.findMany({
      where: { item_id: item.id },
    });
    expect(events).toEqual([]);

    const stored = await prisma.item.findFirst({
      where: { id: item.id },
      select: { status: true },
    });
    expect(stored?.status).toBe("archived");
  });

  it("keeps inbox status when a category is assigned", async () => {
    const category = await request(app).post("/categories").set("Cookie", cookiesA).send({
      name: `تصنيف ${randomUUID()}`,
      color: "teal",
    });
    expect(category.status).toBe(201);

    const item = await createText(cookiesA, "مع تصنيف");
    const patched = await patchItem(cookiesA, item.id, { category_id: category.body.id });
    expect(patched.status).toBe(200);
    const body = patched.body as ItemBody;
    expect(body.status).toBe("inbox");
    expect(body.category_id).toBe(category.body.id);
  });

  it("rejects another user's category and does not attach it", async () => {
    const foreign = await request(app).post("/categories").set("Cookie", cookiesB).send({
      name: `تصنيف ${randomUUID()}`,
      color: "red",
    });
    expect(foreign.status).toBe(201);

    const item = await createText(cookiesA, "تصنيف غيري");
    const touchedAt = await backdateTouch(item.id);
    const patched = await patchItem(cookiesA, item.id, { category_id: foreign.body.id });
    expect(patched.status).toBe(400);
    expect(patched.body).toEqual({ error: "التصنيف مش موجود" });

    const stored = await prisma.item.findFirst({
      where: { id: item.id },
      select: { category_id: true, status: true, last_touched_at: true },
    });
    expect(stored?.category_id).toBeNull();
    expect(stored?.status).toBe("inbox");
    expect(stored?.last_touched_at.toISOString()).toBe(touchedAt.toISOString());
  });

  it("replaces the tag set, ignores order, and rejects another user's tag", async () => {
    const own = await request(app).post("/tags").set("Cookie", cookiesA).send({
      name: `وسم ${randomUUID()}`,
    });
    const second = await request(app).post("/tags").set("Cookie", cookiesA).send({
      name: `وسم ${randomUUID()}`,
    });
    const foreign = await request(app).post("/tags").set("Cookie", cookiesB).send({
      name: `وسم ${randomUUID()}`,
    });
    expect(own.status).toBe(201);
    expect(second.status).toBe(201);
    expect(foreign.status).toBe(201);

    const item = await createText(cookiesA, "مع وسوم");
    const firstId = own.body.id as string;
    const secondId = second.body.id as string;

    const attached = await patchItem(cookiesA, item.id, { tag_ids: [secondId, firstId] });
    expect(attached.status).toBe(200);
    expect((attached.body as ItemBody).status).toBe("inbox");
    expect((attached.body as ItemBody).tag_ids).toEqual([firstId, secondId].sort());

    const touchedAt = await backdateTouch(item.id);
    const sameSet = await patchItem(cookiesA, item.id, { tag_ids: [firstId, secondId] });
    expect(sameSet.status).toBe(200);
    expect((sameSet.body as ItemBody).last_touched_at).toBe(touchedAt.toISOString());

    const mixed = await patchItem(cookiesA, item.id, {
      tag_ids: [firstId, foreign.body.id as string],
    });
    expect(mixed.status).toBe(400);
    expect(mixed.body).toEqual({ error: "الوسم مش موجود" });

    const joins = await prisma.itemTag.findMany({
      where: { item_id: item.id },
      select: { tag_id: true },
    });
    expect(joins.map((join) => join.tag_id).sort()).toEqual([firstId, secondId].sort());

    const cleared = await patchItem(cookiesA, item.id, { tag_ids: [] });
    expect(cleared.status).toBe(200);
    expect((cleared.body as ItemBody).tag_ids).toEqual([]);
    const after = await prisma.itemTag.findMany({ where: { item_id: item.id } });
    expect(after).toEqual([]);
  });

  it("keeps last_touched_at when the saved values do not change", async () => {
    const item = await createText(cookiesA, "من غير لمس");
    const touchedAt = await backdateTouch(item.id);
    const patched = await patchItem(cookiesA, item.id, {
      content: "من غير لمس",
      status: "inbox",
      category_id: null,
      tag_ids: [],
    });
    expect(patched.status).toBe(200);
    const body = patched.body as ItemBody;
    expect(body.last_touched_at).toBe(touchedAt.toISOString());
    expect(body.created_at).toBe(item.created_at);

    const edited = await patchItem(cookiesA, item.id, { content: "اتلمست" });
    expect(edited.status).toBe(200);
    const editedBody = edited.body as ItemBody;
    expect(editedBody.content).toBe("اتلمست");
    expect(editedBody.last_touched_at).not.toBe(touchedAt.toISOString());
    expect(editedBody.created_at).toBe(item.created_at);
  });

  it("keeps a link preview until the URL changes", async () => {
    const created = await request(app).post("/items").set("Cookie", cookiesA).send({
      type: "link",
      content: "https://example.com/old",
    });
    expect(created.status).toBe(201);
    const item = created.body as ItemBody;
    const preview = {
      site_name: "Example",
      title: "Old title",
      description: "Old",
      image_url: "https://example.com/old.png",
    };
    await prisma.item.update({
      where: { id: item.id },
      data: { link_preview: preview },
    });
    const touchedAt = await backdateTouch(item.id);

    const same = await patchItem(cookiesA, item.id, { content: "https://example.com/old" });
    expect(same.status).toBe(200);
    const sameBody = same.body as ItemBody;
    expect(sameBody.link_preview).toEqual(preview);
    expect(sameBody.last_touched_at).toBe(touchedAt.toISOString());

    const changed = await patchItem(cookiesA, item.id, { content: "https://example.com/new" });
    expect(changed.status).toBe(200);
    const changedBody = changed.body as ItemBody;
    expect(changedBody.content).toBe("https://example.com/new");
    expect(changedBody.link_preview).not.toEqual(preview);
    expect(changedBody.last_touched_at).not.toBe(touchedAt.toISOString());
  });

  it("leaves a deleted event with a null item id after permanent delete", async () => {
    const item = await createText(cookiesA, "هتتحذف");
    const before = await prisma.clearEvent.count({
      where: { user_id: userAId, kind: "deleted" },
    });

    const deleted = await request(app).delete(`/items/${item.id}`).set("Cookie", cookiesA);
    expect(deleted.status).toBe(204);

    const stored = await prisma.item.findFirst({
      where: { id: item.id },
      select: { id: true },
    });
    expect(stored).toBeNull();

    const events = await prisma.clearEvent.findMany({
      where: { user_id: userAId, kind: "deleted" },
      orderBy: { created_at: "desc" },
    });
    expect(events).toHaveLength(before + 1);
    expect(events[0]?.item_id).toBeNull();
    expect(events[0]?.user_id).toBe(userAId);
  });

  it("returns 404 when another user patches or deletes the item", async () => {
    const item = await createText(cookiesA, "ملاحظة خاصة");
    const before = await prisma.clearEvent.count({
      where: { user_id: userAId, kind: "deleted" },
    });

    const patched = await patchItem(cookiesB, item.id, { status: "done" });
    expect(patched.status).toBe(404);
    expect(patched.body).toEqual({ error: "مش موجود" });

    const removed = await request(app).delete(`/items/${item.id}`).set("Cookie", cookiesB);
    expect(removed.status).toBe(404);
    expect(removed.body).toEqual({ error: "مش موجود" });

    const stored = await prisma.item.findFirst({
      where: { id: item.id },
      select: { status: true, content: true },
    });
    expect(stored?.status).toBe("inbox");
    expect(stored?.content).toBe("ملاحظة خاصة");

    const after = await prisma.clearEvent.count({
      where: { user_id: userAId, kind: "deleted" },
    });
    expect(after).toBe(before);

    const missing = await patchItem(cookiesA, "missing-item", { status: "done" });
    expect(missing.status).toBe(404);
  });

  it("rejects an unknown status", async () => {
    const item = await createText(cookiesA, "حالة غلط");
    const patched = await patchItem(cookiesA, item.id, { status: "later" });
    expect(patched.status).toBe(400);
    expect(patched.body).toEqual({ error: "الحالة مش معروفة" });
  });
});
