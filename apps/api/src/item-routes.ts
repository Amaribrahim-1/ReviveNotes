import {
  createItemSchema,
  itemListQuerySchema,
  linkContentSchema,
  textContentSchema,
  updateItemSchema,
} from "@revivenotes/shared";
import type { Request, Response } from "express";
import { prisma } from "./db.js";
import { Prisma } from "./generated/prisma/client.js";
import { readSignedInUser } from "./require-user.js";
import { getUserDayRange } from "./user-day.js";

const PAGE_SIZE = 30;
const NOT_FOUND = "مش موجود";
const BAD_CURSOR = "المؤشر مش مفهوم";
const BAD_CATEGORY = "التصنيف مش موجود";
const BAD_TAG = "الوسم مش موجود";
const CONTENT_LOCKED = "مش ممكن تعدل المحتوى ده";

const itemSelect = {
  id: true,
  type: true,
  content: true,
  status: true,
  category_id: true,
  link_preview: true,
  created_at: true,
  last_touched_at: true,
  item_tags: {
    select: { tag_id: true },
  },
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

type StoredItem = {
  id: string;
  type: "link" | "text" | "voice" | "image";
  content: string;
  status: "inbox" | "active" | "done" | "archived";
  category_id: string | null;
  link_preview: unknown;
  created_at: Date;
  last_touched_at: Date;
  item_tags: { tag_id: string }[];
};

function tagIdsOf(joins: { tag_id: string }[]): string[] {
  return joins.map((join) => join.tag_id).sort();
}

function sameIdSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort();
  const sortedRight = [...right].sort();
  for (let index = 0; index < sortedLeft.length; index += 1) {
    if (sortedLeft[index] !== sortedRight[index]) {
      return false;
    }
  }
  return true;
}

function uniqueIds(ids: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const id of ids) {
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  return unique;
}

function toItem(row: StoredItem, user: { timezone: string; day_start_time: number }) {
  // local_date is calculated from created_at when the row is read. The stored instant stays UTC.
  const localDate = getUserDayRange(user.timezone, user.day_start_time, row.created_at).localDate;
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    status: row.status,
    category_id: row.category_id,
    tag_ids: tagIdsOf(row.item_tags),
    link_preview: row.link_preview,
    created_at: row.created_at.toISOString(),
    last_touched_at: row.last_touched_at.toISOString(),
    local_date: localDate,
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

  res.status(201).json(toItem(item, user));
}

function listWhere(
  userId: string,
  query: {
    status?: StoredItem["status"];
    type?: StoredItem["type"];
    category_id?: string;
    tag?: string[];
  },
  cursor: { createdAt: Date; id: string } | null,
): Prisma.ItemWhereInput {
  // Each of these is one AND condition. Tags are the exception: any listed tag matches.
  const filters: Prisma.ItemWhereInput[] = [{ user_id: userId }];

  if (query.status) {
    filters.push({ status: query.status });
  }
  if (query.type) {
    filters.push({ type: query.type });
  }
  if (query.category_id) {
    filters.push({ category_id: query.category_id });
  }
  if (query.tag && query.tag.length > 0) {
    filters.push({
      item_tags: { some: { tag_id: { in: query.tag } } },
    });
  }
  // The cursor OR stays in its own AND slot. It must not replace the tag match.
  if (cursor) {
    filters.push({
      OR: [
        { created_at: { lt: cursor.createdAt } },
        { created_at: cursor.createdAt, id: { lt: cursor.id } },
      ],
    });
  }

  return { AND: filters };
}

export async function listItems(req: Request, res: Response) {
  const parsed = itemListQuerySchema.safeParse({
    status: req.query.status,
    type: req.query.type,
    category_id: req.query.category_id,
    tag: req.query.tag,
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
    where: listWhere(user.id, parsed.data, cursor),
    orderBy: [{ created_at: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    select: itemSelect,
  });

  const page = rows.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  const nextCursor = rows.length > PAGE_SIZE && last ? encodeCursor(last.created_at, last.id) : null;

  res.json({
    items: page.map((row) => toItem(row, user)),
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

  res.json(toItem(item, user));
}

export async function updateItem(req: Request, res: Response) {
  const parsed = updateItemSchema.safeParse(req.body);
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

  const item = await prisma.item.findFirst({
    where: { id, user_id: user.id },
    select: itemSelect,
  });
  if (!item) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  let nextContent = item.content;
  let contentChanged = false;
  if (parsed.data.content !== undefined) {
    if (item.type === "voice" || item.type === "image") {
      res.status(400).json({ error: CONTENT_LOCKED });
      return;
    }
    if (item.type === "text") {
      const text = textContentSchema.safeParse(parsed.data.content);
      if (!text.success) {
        res.status(400).json({ error: firstIssueMessage(text.error.issues) });
        return;
      }
      nextContent = text.data;
    }
    if (item.type === "link") {
      const link = linkContentSchema.safeParse(parsed.data.content);
      if (!link.success) {
        res.status(400).json({ error: firstIssueMessage(link.error.issues) });
        return;
      }
      nextContent = link.data;
    }
    contentChanged = nextContent !== item.content;
  }

  const nextStatus = parsed.data.status ?? item.status;
  const statusChanged = nextStatus !== item.status;

  let nextCategoryId = item.category_id;
  let categoryChanged = false;
  if (parsed.data.category_id !== undefined && parsed.data.category_id !== item.category_id) {
    if (parsed.data.category_id !== null) {
      const category = await prisma.category.findFirst({
        where: { id: parsed.data.category_id, user_id: user.id },
        select: { id: true },
      });
      if (!category) {
        res.status(400).json({ error: BAD_CATEGORY });
        return;
      }
    }
    nextCategoryId = parsed.data.category_id;
    categoryChanged = true;
  }

  const currentTagIds = tagIdsOf(item.item_tags);
  let nextTagIds = currentTagIds;
  let tagsChanged = false;
  if (parsed.data.tag_ids !== undefined) {
    const requested = uniqueIds(parsed.data.tag_ids);
    if (!sameIdSet(requested, currentTagIds)) {
      if (requested.length > 0) {
        const owned = await prisma.tag.findMany({
          where: { user_id: user.id, id: { in: requested } },
          select: { id: true },
        });
        if (owned.length !== requested.length) {
          res.status(400).json({ error: BAD_TAG });
          return;
        }
      }
      nextTagIds = requested;
      tagsChanged = true;
    }
  }

  const touched = contentChanged || statusChanged || categoryChanged || tagsChanged;
  if (!touched) {
    res.json(toItem(item, user));
    return;
  }

  const now = new Date();
  // The window is this user's day. start is included. end is the next day-start, so it is not.
  const day = getUserDayRange(user.timezone, user.day_start_time, now);
  const enteringDone = item.status !== "done" && nextStatus === "done";
  const leavingDone = item.status === "done" && nextStatus !== "done";

  // One transaction: the new values and the clear event commit together.
  await prisma.$transaction(async (tx) => {
    if (tagsChanged) {
      await tx.itemTag.deleteMany({ where: { item_id: item.id } });
      if (nextTagIds.length > 0) {
        await tx.itemTag.createMany({
          data: nextTagIds.map((tagId) => ({
            item_id: item.id,
            tag_id: tagId,
          })),
        });
      }
    }

    const data: {
      content?: string;
      status?: StoredItem["status"];
      category_id?: string | null;
      link_preview?: typeof Prisma.DbNull;
      last_touched_at: Date;
    } = {
      last_touched_at: now,
    };
    if (contentChanged) {
      data.content = nextContent;
      if (item.type === "link") {
        data.link_preview = Prisma.DbNull;
      }
    }
    if (statusChanged) {
      data.status = nextStatus;
    }
    if (categoryChanged) {
      data.category_id = nextCategoryId;
    }

    await tx.item.update({
      where: { id: item.id },
      data,
    });

    if (enteringDone) {
      await tx.clearEvent.create({
        data: {
          user_id: user.id,
          item_id: item.id,
          kind: "done",
          created_at: now,
        },
      });
    }

    if (leavingDone) {
      await tx.clearEvent.deleteMany({
        where: {
          user_id: user.id,
          item_id: item.id,
          kind: "done",
          created_at: {
            gte: day.start,
            lt: day.end,
          },
        },
      });
    }
  });

  const saved = await prisma.item.findFirst({
    where: { id: item.id, user_id: user.id },
    select: itemSelect,
  });
  if (!saved) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  res.json(toItem(saved, user));
}

export async function deleteItem(req: Request, res: Response) {
  const user = readSignedInUser(res);
  const id = paramId(req);
  if (!id) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  const existing = await prisma.item.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: NOT_FOUND });
    return;
  }

  // The deleted event is written first. Deleting the item then sets item_id to null, and the event stays.
  await prisma.$transaction(async (tx) => {
    await tx.clearEvent.create({
      data: {
        user_id: user.id,
        item_id: id,
        kind: "deleted",
      },
    });
    await tx.item.delete({ where: { id } });
  });

  res.status(204).end();
}
