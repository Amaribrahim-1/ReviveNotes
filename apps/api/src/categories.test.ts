import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "./app.js";
import { prisma } from "./db.js";

const password = "password-ok";
const emails: string[] = [];

let cookiesA = "";
let cookiesB = "";
let userAId = "";

function nextEmail(label: string): string {
  const email = `t3-${label}-${randomUUID()}@example.com`;
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

function findRow(body: unknown, id: string): { id: string; name: string } | undefined {
  const rows = body as { id: string; name: string }[];
  return rows.find((row) => row.id === id);
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

describe("categories and tags", () => {
  it.each([
    ["get", "/categories"],
    ["post", "/categories"],
    ["patch", "/categories/missing"],
    ["delete", "/categories/missing"],
    ["get", "/tags"],
    ["post", "/tags"],
    ["patch", "/tags/missing"],
    ["delete", "/tags/missing"],
  ] as const)("%s %s without a session returns 401", async (method, path) => {
    const response = await request(app)[method](path);
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "لازم تسجل دخول" });
  });

  it("creates a category and renames it", async () => {
    const created = await request(app).post("/categories").set("Cookie", cookiesA).send({
      name: "  قراءة  ",
      color: "teal",
    });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "قراءة", color: "teal" });

    const renamed = await request(app)
      .patch(`/categories/${created.body.id}`)
      .set("Cookie", cookiesA)
      .send({ name: "قراءة لاحقة", color: "green" });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toEqual({
      id: created.body.id,
      name: "قراءة لاحقة",
      color: "green",
    });

    const loaded = await request(app).get("/categories").set("Cookie", cookiesA);
    expect(findRow(loaded.body, created.body.id as string)).toEqual(renamed.body);
  });

  it("creates a tag and renames it", async () => {
    const created = await request(app).post("/tags").set("Cookie", cookiesA).send({
      name: "  عاجل  ",
    });
    expect(created.status).toBe(201);
    expect(created.body).toEqual({ id: created.body.id, name: "عاجل" });

    const renamed = await request(app)
      .patch(`/tags/${created.body.id}`)
      .set("Cookie", cookiesA)
      .send({ name: "مهم" });
    expect(renamed.status).toBe(200);
    expect(renamed.body).toEqual({ id: created.body.id, name: "مهم" });

    const loaded = await request(app).get("/tags").set("Cookie", cookiesA);
    expect(findRow(loaded.body, created.body.id as string)).toEqual(renamed.body);
  });

  it("rejects a category name that matches another name of the same user, ignoring case", async () => {
    const created = await request(app).post("/categories").set("Cookie", cookiesA).send({
      name: "  Work  ",
      color: "blue",
    });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe("Work");

    const duplicate = await request(app).post("/categories").set("Cookie", cookiesA).send({
      name: "work",
      color: "red",
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body).toEqual({ error: "الاسم ده موجود عندك" });

    const other = await request(app).post("/categories").set("Cookie", cookiesA).send({
      name: "Other",
      color: "amber",
    });
    expect(other.status).toBe(201);

    const collided = await request(app)
      .patch(`/categories/${other.body.id}`)
      .set("Cookie", cookiesA)
      .send({ name: "WORK", color: "amber" });
    expect(collided.status).toBe(400);
    expect(collided.body).toEqual({ error: "الاسم ده موجود عندك" });

    const ownCasing = await request(app)
      .patch(`/categories/${created.body.id}`)
      .set("Cookie", cookiesA)
      .send({ name: "WORK", color: "blue" });
    expect(ownCasing.status).toBe(200);
    expect(ownCasing.body.name).toBe("WORK");

    const list = await request(app).get("/categories").set("Cookie", cookiesA);
    expect(findRow(list.body, other.body.id as string)?.name).toBe("Other");
  });

  it("rejects a tag name that matches another name of the same user, ignoring case", async () => {
    const created = await request(app).post("/tags").set("Cookie", cookiesA).send({ name: "Later" });
    expect(created.status).toBe(201);

    const duplicate = await request(app).post("/tags").set("Cookie", cookiesA).send({ name: "later" });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body).toEqual({ error: "الاسم ده موجود عندك" });

    const ownCasing = await request(app)
      .patch(`/tags/${created.body.id}`)
      .set("Cookie", cookiesA)
      .send({ name: "LATER" });
    expect(ownCasing.status).toBe(200);
    expect(ownCasing.body.name).toBe("LATER");
  });

  it("lets two users create a category with the same name", async () => {
    const first = await request(app).post("/categories").set("Cookie", cookiesA).send({
      name: "أفكار",
      color: "violet",
    });
    const second = await request(app).post("/categories").set("Cookie", cookiesB).send({
      name: "أفكار",
      color: "pink",
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.id).not.toBe(second.body.id);
  });

  it("lets two users create a tag with the same name", async () => {
    const first = await request(app).post("/tags").set("Cookie", cookiesA).send({ name: "أفكار" });
    const second = await request(app).post("/tags").set("Cookie", cookiesB).send({ name: "أفكار" });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.id).not.toBe(second.body.id);
  });

  it.each(["#ff0000", "purple"])("rejects category color %s", async (color) => {
    const before = await request(app).get("/categories").set("Cookie", cookiesA);
    const rejected = await request(app).post("/categories").set("Cookie", cookiesA).send({
      name: "لون مرفوض",
      color,
    });
    const after = await request(app).get("/categories").set("Cookie", cookiesA);

    expect(rejected.status).toBe(400);
    expect(rejected.body).toEqual({ error: "اختار لون من الألوان المتاحة" });
    expect(after.body).toEqual(before.body);
  });

  it.each([
    ["blank category", "/categories", { name: "", color: "blue" }],
    ["whitespace category", "/categories", { name: "   ", color: "blue" }],
    ["blank tag", "/tags", { name: "" }],
    ["whitespace tag", "/tags", { name: "   " }],
  ] as const)("rejects a %s", async (_label, path, body) => {
    const before = await request(app).get(path).set("Cookie", cookiesA);
    const response = await request(app).post(path).set("Cookie", cookiesA).send(body);
    const after = await request(app).get(path).set("Cookie", cookiesA);
    expect(response.status).toBe(400);
    expect(after.body).toEqual(before.body);
  });

  it("returns 404 when another user updates or deletes a category", async () => {
    const created = await request(app).post("/categories").set("Cookie", cookiesA).send({
      name: `خاص-${randomUUID()}`,
      color: "red",
    });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const missing = await request(app).patch("/categories/missing-category").set("Cookie", cookiesA).send({
      name: "مش موجود",
      color: "blue",
    });
    const update = await request(app).patch(`/categories/${id}`).set("Cookie", cookiesB).send({
      name: "مسروق",
      color: "blue",
    });
    const remove = await request(app).delete(`/categories/${id}`).set("Cookie", cookiesB);

    expect(missing.status).toBe(404);
    expect(update.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(missing.body).toEqual({ error: "مش موجود" });
    expect(update.body).toEqual(missing.body);
    expect(remove.body).toEqual(missing.body);

    const listA = await request(app).get("/categories").set("Cookie", cookiesA);
    expect(findRow(listA.body, id)?.name).toBe(created.body.name);

    const listB = await request(app).get("/categories").set("Cookie", cookiesB);
    expect(findRow(listB.body, id)).toBeUndefined();
  });

  it("returns 404 when another user updates or deletes a tag", async () => {
    const created = await request(app).post("/tags").set("Cookie", cookiesA).send({
      name: `خاص-${randomUUID()}`,
    });
    expect(created.status).toBe(201);
    const id = created.body.id as string;

    const missing = await request(app).patch("/tags/missing-tag").set("Cookie", cookiesA).send({
      name: "مش موجود",
    });
    const update = await request(app).patch(`/tags/${id}`).set("Cookie", cookiesB).send({
      name: "مسروق",
    });
    const remove = await request(app).delete(`/tags/${id}`).set("Cookie", cookiesB);

    expect(missing.status).toBe(404);
    expect(update.status).toBe(404);
    expect(remove.status).toBe(404);
    expect(missing.body).toEqual({ error: "مش موجود" });
    expect(update.body).toEqual(missing.body);
    expect(remove.body).toEqual(missing.body);

    const listA = await request(app).get("/tags").set("Cookie", cookiesA);
    expect(findRow(listA.body, id)?.name).toBe(created.body.name);

    const listB = await request(app).get("/tags").set("Cookie", cookiesB);
    expect(findRow(listB.body, id)).toBeUndefined();
  });

  it("leaves the item in place with category_id null when the category is deleted", async () => {
    const created = await request(app).post("/categories").set("Cookie", cookiesA).send({
      name: `فئة-${randomUUID().slice(0, 8)}`,
      color: "orange",
    });
    expect(created.status).toBe(201);

    const touchedAt = new Date("2020-01-15T08:00:00.000Z");
    const item = await prisma.item.create({
      data: {
        user_id: userAId,
        type: "text",
        content: "ملاحظة قديمة",
        category_id: created.body.id as string,
        status: "active",
        last_touched_at: touchedAt,
      },
    });

    const removed = await request(app)
      .delete(`/categories/${created.body.id}`)
      .set("Cookie", cookiesA);
    expect(removed.status).toBe(204);

    const after = await prisma.item.findUnique({ where: { id: item.id } });
    expect(after).not.toBeNull();
    expect(after?.category_id).toBeNull();
    expect(after?.status).toBe("active");
    expect(after?.content).toBe("ملاحظة قديمة");
    expect(after?.last_touched_at.toISOString()).toBe(touchedAt.toISOString());

    const list = await request(app).get("/categories").set("Cookie", cookiesA);
    expect(findRow(list.body, created.body.id as string)).toBeUndefined();
  });

  it("leaves the item in place when the tag is deleted", async () => {
    const created = await request(app).post("/tags").set("Cookie", cookiesA).send({
      name: `وسم-${randomUUID()}`,
    });
    expect(created.status).toBe(201);

    const touchedAt = new Date("2020-01-15T08:00:00.000Z");
    const item = await prisma.item.create({
      data: {
        user_id: userAId,
        type: "text",
        content: "ملاحظة بوسم",
        status: "inbox",
        last_touched_at: touchedAt,
      },
    });
    await prisma.itemTag.create({
      data: {
        item_id: item.id,
        tag_id: created.body.id as string,
      },
    });

    const removed = await request(app).delete(`/tags/${created.body.id}`).set("Cookie", cookiesA);
    expect(removed.status).toBe(204);

    const joins = await prisma.itemTag.findMany({ where: { item_id: item.id } });
    expect(joins).toHaveLength(0);

    const after = await prisma.item.findUnique({ where: { id: item.id } });
    expect(after).not.toBeNull();
    expect(after?.content).toBe("ملاحظة بوسم");
    expect(after?.status).toBe("inbox");
    expect(after?.last_touched_at.toISOString()).toBe(touchedAt.toISOString());

    const list = await request(app).get("/tags").set("Cookie", cookiesA);
    expect(findRow(list.body, created.body.id as string)).toBeUndefined();
  });
});
