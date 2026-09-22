import { createItemSchema, itemListQuerySchema } from "@revivenotes/shared";
import type { Request, Response } from "express";
import { prisma } from "./db.js";
import { readSignedInUser } from "./require-user.js";

const PAGE_SIZE = 30;
const NOT_FOUND = "مش موجود";
const BAD_CURSOR = "المؤشر مش مفهوم";

const itemSelect = {
  id: true,
  type: true,
  content: true,
  status: true,
  category_id: true,
  link_preview: true,
  created_at: true,
  last_touched_at: true,
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

function encodeCursor(createdAt: Date, id: string): string {
  return `${createdAt.toISOString()}|${id}`;
}

function readCursor(value: string): { createdAt: Date; id: string } | null {
  const splitAt = value.lastIndexOf("|");
  if (splitAt <= 0) {
    return null;
  }

  const createdAt = new Date(value.slice(0, splitAt));
  const id = value.slice(splitAt + 1);
  if (Number.isNaN(createdAt.getTime()) || id.length === 0) {
    return null;
  }

  return { createdAt, id };
}

function toItem(row: {
  id: string;
  type: string;
  content: string;
  status: string;
  category_id: string | null;
  link_preview: unknown;
  created_at: Date;
  last_touched_at: Date;
}) {
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    status: row.status,
    category_id: row.category_id,
    link_preview: row.link_preview,
    created_at: row.created_at.toISOString(),
    last_touched_at: row.last_touched_at.toISOString(),
  };
}

export async function createItem(req: Request, res: Response) {
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssueMessage(parsed.error.issues) });
    return;
  }

  const user = readSignedInUser(res);
  // One clock read so last_touched_at matches created_at. Reads do not move it later.
  const now = new Date();
  const item = await prisma.item.create({
    data: {
      user_id: user.id,
      type: parsed.data.type,
      content: parsed.data.content,
      status: "inbox",
      created_at: now,
      last_touched_at: now,
    },
    select: itemSelect,
  });

  res.status(201).json(toItem(item));
}

export async function listItems(req: Request, res: Response) {
  const parsed = itemListQuerySchema.safeParse({
    status: req.query.status,
    cursor: req.query.cursor,
  });
  if (!parsed.success) {
    res.status(400).json({ error: firstIssueMessage(parsed.error.issues) });
    return;
  }

  let cursor: { createdAt: Date; id: string } | null = null;
  const cursorValue = parsed.data.cursor;
  if (cursorValue) {
    cursor = readCursor(cursorValue);
    if (!cursor) {
      res.status(400).json({ error: BAD_CURSOR });
      return;
    }
  }

  const user = readSignedInUser(res);
  // Read one extra row so we know if another page exists. The body still has 30.
  const rows = await prisma.item.findMany({
    where: {
      user_id: user.id,
      ...(parsed.data.status ? { status: parsed.data.status } : {}),
      ...(cursor
        ? {
            OR: [
              { created_at: { lt: cursor.createdAt } },
              { created_at: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    select: itemSelect,
  });

  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  const nextCursor = rows.length > PAGE_SIZE && last ? encodeCursor(last.created_at, last.id) : null;

  res.json({
    items: page.map(toItem),
    next_cursor: nextCursor,
  });
}

export async function getItem(req: Request, res: Response) {
  const user = readSignedInUser(res);
  const id = paramId(req);
  if (!id) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  const item = await prisma.item.findFirst({
    where: { id, user_id: user.id },
    select: itemSelect,
  });
  if (!item) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  res.json(toItem(item));
}
