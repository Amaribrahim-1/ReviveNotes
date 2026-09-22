import { randomUUID } from "node:crypto";
import { afterAll, expect, it } from "vitest";
import { prisma } from "./db.js";

const emailA = `t1-a-${randomUUID()}@example.com`;
const emailB = `t1-b-${randomUUID()}@example.com`;

afterAll(async () => {
  await prisma.user.deleteMany({
    where: { email: { in: [emailA, emailB] } },
  });
  await prisma.$disconnect();
});

it("lets two users share a category name_key and rejects a duplicate for one user", async () => {
  const userA = await prisma.user.create({
    data: {
      email: emailA,
      password_hash: "not-a-real-hash",
      timezone: "Africa/Cairo",
    },
  });
  const userB = await prisma.user.create({
    data: {
      email: emailB,
      password_hash: "not-a-real-hash",
      timezone: "Africa/Cairo",
    },
  });

  await prisma.category.create({
    data: {
      user_id: userA.id,
      name: "Work",
      name_key: "work",
      color: "blue",
    },
  });
  await prisma.category.create({
    data: {
      user_id: userB.id,
      name: "Work",
      name_key: "work",
      color: "blue",
    },
  });

  const shared = await prisma.category.findMany({
    where: {
      name_key: "work",
      user_id: { in: [userA.id, userB.id] },
    },
  });

  expect(shared).toHaveLength(2);

  await expect(
    prisma.category.create({
      data: {
        user_id: userA.id,
        name: "WORK",
        name_key: "work",
        color: "red",
      },
    }),
  ).rejects.toMatchObject({ code: "P2002" });
});
