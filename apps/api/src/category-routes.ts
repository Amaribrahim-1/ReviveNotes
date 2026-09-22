import { categorySchema } from "@revivenotes/shared";
import type { Request, Response } from "express";
import { NAME_TAKEN, NOT_FOUND } from "./label-messages.js";
import { isUniqueNameError, nameKey } from "./name-key.js";
import { prisma } from "./db.js";
import { readSignedInUser } from "./require-user.js";

const categorySelect = {
  id: true,
  name: true,
  color: true,
} as const;

function firstIssueMessage(issues: { message: string }[]): string {
  return issues[0]?.message ?? "البيانات مش مظبوطة";
}

function paramId(req: Request): string | null {
  const id = req.params.id;
  if (typeof id !== "string" || id.length === 0) {
    return null;
  }
  return id;
}

export async function listCategories(_req: Request, res: Response) {
  const user = readSignedInUser(res);
  const categories = await prisma.category.findMany({
    where: { user_id: user.id },
    orderBy: { name: "asc" },
    select: categorySelect,
  });
  res.json(categories);
}

export async function createCategory(req: Request, res: Response) {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssueMessage(parsed.error.issues) });
    return;
  }

  const user = readSignedInUser(res);
  const key = nameKey(parsed.data.name);
  const taken = await prisma.category.findFirst({
    where: { user_id: user.id, name_key: key },
    select: { id: true },
  });
  if (taken) {
    res.status(400).json({ error: NAME_TAKEN });
    return;
  }

  try {
    const category = await prisma.category.create({
      data: {
        user_id: user.id,
        name: parsed.data.name,
        name_key: key,
        color: parsed.data.color,
      },
      select: categorySelect,
    });
    res.status(201).json(category);
  } catch (error) {
    if (isUniqueNameError(error)) {
      res.status(400).json({ error: NAME_TAKEN });
      return;
    }
    throw error;
  }
}

export async function updateCategory(req: Request, res: Response) {
  const parsed = categorySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssueMessage(parsed.error.issues) });
    return;
  }

  const user = readSignedInUser(res);
  const id = paramId(req);
  if (!id) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  const existing = await prisma.category.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  const key = nameKey(parsed.data.name);
  const taken = await prisma.category.findFirst({
    where: {
      user_id: user.id,
      name_key: key,
      id: { not: id },
    },
    select: { id: true },
  });
  if (taken) {
    res.status(400).json({ error: NAME_TAKEN });
    return;
  }

  try {
    const category = await prisma.category.update({
      where: { id },
      data: {
        name: parsed.data.name,
        name_key: key,
        color: parsed.data.color,
      },
      select: categorySelect,
    });
    res.json(category);
  } catch (error) {
    if (isUniqueNameError(error)) {
      res.status(400).json({ error: NAME_TAKEN });
      return;
    }
    throw error;
  }
}

export async function deleteCategory(req: Request, res: Response) {
  const user = readSignedInUser(res);
  const id = paramId(req);
  if (!id) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  const existing = await prisma.category.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  // Postgres sets item.category_id to null. Status and last_touched_at stay as they are.
  await prisma.category.delete({ where: { id } });
  res.status(204).end();
}
