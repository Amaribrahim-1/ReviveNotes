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
  const email = `t7-${label}-${randomUUID()}@example.com`;
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
  created_at: string;
};

type ItemPageBody = {
  items: ItemBody[];
  next_cursor: string | null;
};

function itemIds(body: ItemPageBody): string[] {
  return body.items.map((item) => item.id);
}

async function createCategory(cookies: string, name: string): Promise<string> {
  const created = await request(app).post("/categories").set("Cookie", cookies).send({
    name,
    color: "blue",
  });
  expect(created.status).toBe(201);
  return (created.body as { id: string }).id;
}

async function createTag(cookies: string, name: string): Promise<string> {
  const created = await request(app).post("/tags").set("Cookie", cookies).send({ name });
  expect(created.status).toBe(201);
  return (created.body as { id: string }).id;
}

async function createItem(
  cookies: string,
  body: { type: "text"; content: string } | { type: "link"; content: string },
): Promise<ItemBody> {
  const created = await request(app).post("/items").set("Cookie", cookies).send(body);
  expect(created.status).toBe(201);
  return created.body as ItemBody;
}

function patchItem(cookies: string, id: string, body: Record<string, unknown>) {
  return request(app).patch(`/items/${id}`).set("Cookie", cookies).send(body);
}

function listItems(cookies: string, params: URLSearchParams) {
  return request(app).get(`/items?${params.toString()}`).set("Cookie", cookies);
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

describe("item list filters", () => {
  it("keeps category, status, and type together and matches either tag", async () => {
    const suffix = randomUUID();
    const categoryA = await createCategory(cookiesA, `عمل ${suffix}`);
    const categoryB = await createCategory(cookiesA, `بيت ${suffix}`);
    const tagA = await createTag(cookiesA, `عاجل ${suffix}`);
    const tagB = await createTag(cookiesA, `لاحق ${suffix}`);

    const matchTagA = await createItem(cookiesA, { type: "text", content: "في التصنيف ومع الوسم الأول" });
    const matchTagB = await createItem(cookiesA, { type: "text", content: "في التصنيف ومع الوسم الثاني" });
    const otherCategory = await createItem(cookiesA, { type: "text", content: "وسم الأول في تصنيف تاني" });
    const otherType = await createItem(cookiesA, { type: "link", content: "https://example.com/filter" });
    const otherStatus = await createItem(cookiesA, { type: "text", content: "خلصت" });

    expect((await patchItem(cookiesA, matchTagA.id, { category_id: categoryA, tag_ids: [tagA] })).status).toBe(200);
    expect((await patchItem(cookiesA, matchTagB.id, { category_id: categoryA, tag_ids: [tagB] })).status).toBe(200);
    expect((await patchItem(cookiesA, otherCategory.id, { category_id: categoryB, tag_ids: [tagA] })).status).toBe(200);
    expect((await patchItem(cookiesA, otherType.id, { category_id: categoryA, tag_ids: [tagA] })).status).toBe(200);
    expect(
      (await patchItem(cookiesA, otherStatus.id, { category_id: categoryA, tag_ids: [tagA], status: "done" })).status,
    ).toBe(200);

    const bothTags = new URLSearchParams();
    bothTags.set("category_id", categoryA);
    bothTags.set("status", "inbox");
    bothTags.set("type", "text");
    bothTags.append("tag", tagA);
    bothTags.append("tag", tagB);

    const listed = await listItems(cookiesA, bothTags);
    expect(listed.status).toBe(200);
    expect(itemIds(listed.body as ItemPageBody).sort()).toEqual([matchTagA.id, matchTagB.id].sort());

    const oneTag = new URLSearchParams();
    oneTag.set("category_id", categoryA);
    oneTag.set("status", "inbox");
    oneTag.set("type", "text");
    oneTag.append("tag", tagA);
    const onlyFirstTag = await listItems(cookiesA, oneTag);
    expect(onlyFirstTag.status).toBe(200);
    expect(itemIds(onlyFirstTag.body as ItemPageBody)).toEqual([matchTagA.id]);
  });

  it("returns items in the other filters when tag is omitted", async () => {
    const suffix = randomUUID();
    const categoryA = await createCategory(cookiesA, `مكتب ${suffix}`);
    const tagA = await createTag(cookiesA, `مهم ${suffix}`);
    const withTag = await createItem(cookiesA, { type: "text", content: "بوسم" });
    const withoutTag = await createItem(cookiesA, { type: "text", content: "من غير وسم" });

    expect((await patchItem(cookiesA, withTag.id, { category_id: categoryA, tag_ids: [tagA] })).status).toBe(200);
    expect((await patchItem(cookiesA, withoutTag.id, { category_id: categoryA, tag_ids: [] })).status).toBe(200);

    const params = new URLSearchParams();
    params.set("category_id", categoryA);
    params.set("status", "inbox");
    params.set("type", "text");

    const listed = await listItems(cookiesA, params);
    expect(listed.status).toBe(200);
    expect(itemIds(listed.body as ItemPageBody).sort()).toEqual([withTag.id, withoutTag.id].sort());
  });

  it("returns every status when status is omitted", async () => {
    const suffix = randomUUID();
    const categoryA = await createCategory(cookiesA, `حالة ${suffix}`);
    const inboxItem = await createItem(cookiesA, { type: "text", content: "لسه في الوارد" });
    const doneItem = await createItem(cookiesA, { type: "text", content: "اتعملت" });

    expect((await patchItem(cookiesA, inboxItem.id, { category_id: categoryA })).status).toBe(200);
    expect((await patchItem(cookiesA, doneItem.id, { category_id: categoryA, status: "done" })).status).toBe(200);

    const params = new URLSearchParams();
    params.set("category_id", categoryA);
    params.set("type", "text");

    const listed = await listItems(cookiesA, params);
    expect(listed.status).toBe(200);
    expect(itemIds(listed.body as ItemPageBody).sort()).toEqual([inboxItem.id, doneItem.id].sort());
  });

  it("returns an empty page for another user's category", async () => {
    const suffix = randomUUID();
    const categoryA = await createCategory(cookiesA, `خاص ${suffix}`);
    const categoryB = await createCategory(cookiesB, `خاص ب ${suffix}`);
    const tagA = await createTag(cookiesA, `خاص ${suffix}`);
    const item = await createItem(cookiesA, { type: "text", content: "ملاحظة أ" });
    expect((await patchItem(cookiesA, item.id, { category_id: categoryA, tag_ids: [tagA] })).status).toBe(200);

    const sameQuery = new URLSearchParams();
    sameQuery.set("category_id", categoryA);
    sameQuery.set("status", "inbox");
    sameQuery.set("type", "text");
    sameQuery.append("tag", tagA);

    const asA = await listItems(cookiesA, sameQuery);
    expect(asA.status).toBe(200);
    expect(itemIds(asA.body as ItemPageBody)).toEqual([item.id]);

    const asB = await listItems(cookiesB, sameQuery);
    expect(asB.status).toBe(200);
    expect(itemIds(asB.body as ItemPageBody)).toEqual([]);

    const foreignCategory = new URLSearchParams();
    foreignCategory.set("category_id", categoryB);
    const asAWithB = await listItems(cookiesA, foreignCategory);
    expect(asAWithB.status).toBe(200);
    expect(itemIds(asAWithB.body as ItemPageBody)).toEqual([]);
  });

  it("keeps the next page inside the same filter", async () => {
    const suffix = randomUUID();
    const categoryA = await createCategory(cookiesA, `قديم ${suffix}`);
    const categoryB = await createCategory(cookiesA, `وسط ${suffix}`);
    const tagA = await createTag(cookiesA, `سلسلة ${suffix}`);

    const older = await createItem(cookiesA, { type: "text", content: "الأقدم" });
    const middle = await createItem(cookiesA, { type: "text", content: "في النص وتصنيف تاني" });
    const newest = await createItem(cookiesA, { type: "text", content: "الأحدث" });

    expect((await patchItem(cookiesA, older.id, { category_id: categoryA, tag_ids: [tagA] })).status).toBe(200);
    expect((await patchItem(cookiesA, middle.id, { category_id: categoryB, tag_ids: [tagA] })).status).toBe(200);
    expect((await patchItem(cookiesA, newest.id, { category_id: categoryA, tag_ids: [tagA] })).status).toBe(200);

    await prisma.item.update({
      where: { id: older.id },
      data: { created_at: new Date("2020-01-01T00:00:00.000Z") },
    });
    await prisma.item.update({
      where: { id: middle.id },
      data: { created_at: new Date("2020-01-02T00:00:00.000Z") },
    });
    await prisma.item.update({
      where: { id: newest.id },
      data: { created_at: new Date("2020-01-03T00:00:00.000Z") },
    });

    const params = new URLSearchParams();
    params.set("category_id", categoryA);
    params.append("tag", tagA);

    const first = await listItems(cookiesA, params);
    expect(first.status).toBe(200);
    const firstPage = first.body as ItemPageBody;
    expect(itemIds(firstPage)).toEqual([newest.id, older.id]);

    const newestRow = firstPage.items[0];
    expect(newestRow).toBeDefined();
    const nextParams = new URLSearchParams(params);
    nextParams.set("cursor", `${newestRow?.created_at}|${newestRow?.id}`);

    const second = await listItems(cookiesA, nextParams);
    expect(second.status).toBe(200);
    expect(itemIds(second.body as ItemPageBody)).toEqual([older.id]);
  });
});
