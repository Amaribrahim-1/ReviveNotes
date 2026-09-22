import { tagSchema } from "@revivenotes/shared";
import type { Request, Response } from "express";
import { NAME_TAKEN, NOT_FOUND } from "./label-messages.js";
import { isUniqueNameError, nameKey } from "./name-key.js";
import { prisma } from "./db.js";
import { readSignedInUser } from "./require-user.js";

const tagSelect = {
  id: true,
  name: true,
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

export async function listTags(_req: Request, res: Response) {
  const user = readSignedInUser(res);
  const tags = await prisma.tag.findMany({
    where: { user_id: user.id },
    orderBy: { name: "asc" },
    select: tagSelect,
  });
  res.json(tags);
}

export async function createTag(req: Request, res: Response) {
  const parsed = tagSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssueMessage(parsed.error.issues) });
    return;
  }

  const user = readSignedInUser(res);
  const key = nameKey(parsed.data.name);
  const taken = await prisma.tag.findFirst({
    where: { user_id: user.id, name_key: key },
    select: { id: true },
  });
  if (taken) {
    res.status(400).json({ error: NAME_TAKEN });
    return;
  }

  try {
    const tag = await prisma.tag.create({
      data: {
        user_id: user.id,
        name: parsed.data.name,
        name_key: key,
      },
      select: tagSelect,
    });
    res.status(201).json(tag);
  } catch (error) {
    if (isUniqueNameError(error)) {
      res.status(400).json({ error: NAME_TAKEN });
      return;
    }
    throw error;
  }
}

export async function updateTag(req: Request, res: Response) {
  const parsed = tagSchema.safeParse(req.body);
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

  const existing = await prisma.tag.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  const key = nameKey(parsed.data.name);
  const taken = await prisma.tag.findFirst({
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
    const tag = await prisma.tag.update({
      where: { id },
      data: {
        name: parsed.data.name,
        name_key: key,
      },
      select: tagSelect,
    });
    res.json(tag);
  } catch (error) {
    if (isUniqueNameError(error)) {
      res.status(400).json({ error: NAME_TAKEN });
      return;
    }
    throw error;
  }
}

export async function deleteTag(req: Request, res: Response) {
  const user = readSignedInUser(res);
  const id = paramId(req);
  if (!id) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  const existing = await prisma.tag.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  // Postgres removes the join rows. The items stay, and last_touched_at stays.
  await prisma.tag.delete({ where: { id } });
  res.status(204).end();
}
