import { randomUUID } from "node:crypto";
import {
  createItemSchema,
  IMAGE_MAX_BYTES,
  imageContentTypeSchema,
  itemListQuerySchema,
  itemNoteSchema,
  linkContentSchema,
  linkPreviewSchema,
  textContentSchema,
  updateItemSchema,
  type LinkPreview,
  type MsgKey,
  VOICE_MAX_BYTES,
  voiceDurationSchema,
} from "@revivenotes/shared";
import type { Request, Response } from "express";
import multer from "multer";
import { prisma } from "./db.js";
import { Prisma } from "./generated/prisma/client.js";
import { fetchLinkPreview } from "./link-preview.js";
import { deletePrivateObject, openPrivateObject, putPrivateObject } from "./object-store.js";
import { issueMessage, msg } from "./request-locale.js";
import { readSignedInUser } from "./require-user.js";
import { getUserDayRange } from "./user-day.js";

const PAGE_SIZE = 30;
// Seven times 24 hours. This is not the user's day, so day_start_time is not used.
// A touch at exactly this age is still fresh. Only an earlier last_touched_at is stale.
const STALE_MS = 7 * 24 * 60 * 60 * 1000;
const NOT_FOUND: MsgKey = "not_found";
const BAD_CURSOR: MsgKey = "cursor_invalid";
const BAD_CATEGORY: MsgKey = "category_missing";
const BAD_TAG: MsgKey = "tag_missing";
const CONTENT_LOCKED: MsgKey = "content_locked";
const VOICE_TOO_BIG: MsgKey = "voice_too_big";
const VOICE_EMPTY: MsgKey = "voice_empty";
const VOICE_TYPE: MsgKey = "voice_type";
const VOICE_BAD: MsgKey = "voice_bad";
const IMAGE_TOO_BIG: MsgKey = "image_too_big";
const IMAGE_EMPTY: MsgKey = "image_empty";
const IMAGE_TYPE: MsgKey = "image_type";
const IMAGE_BAD: MsgKey = "image_bad";
const SERVER_ERROR: MsgKey = "server_error";

const itemSelect = {
  id: true,
  type: true,
  content: true,
  note: true,
  status: true,
  category_id: true,
  link_preview: true,
  created_at: true,
  last_touched_at: true,
  duration_seconds: true,
  item_tags: {
    select: { tag_id: true },
  },
} as const;

function readOptionalNote(
  req: Request,
  value: unknown,
): { ok: true; note: string | null } | { ok: false; error: string } {
  if (value === undefined) {
    return { ok: true, note: null };
  }
  const parsed = itemNoteSchema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, error: issueMessage(req, parsed.error.issues) };
  }
  return { ok: true, note: parsed.data };
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
  note: string | null;
  status: "inbox" | "active" | "done" | "archived";
  category_id: string | null;
  link_preview: unknown;
  created_at: Date;
  last_touched_at: Date;
  duration_seconds: number | null;
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

function readStoredPreview(value: unknown): LinkPreview | null {
  const parsed = linkPreviewSchema.safeParse(value);
  if (!parsed.success) {
    return null;
  }
  const preview = parsed.data;
  if (!preview.site_name && !preview.title && !preview.description && !preview.image_url) {
    return null;
  }
  return preview;
}

function toItem(row: StoredItem, user: { timezone: string; day_start_time: number }) {
  // local_date is calculated from created_at when the row is read. The stored instant stays UTC.
  const localDate = getUserDayRange(user.timezone, user.day_start_time, row.created_at).localDate;
  return {
    id: row.id,
    type: row.type,
    content: row.content,
    note: row.note,
    status: row.status,
    category_id: row.category_id,
    tag_ids: tagIdsOf(row.item_tags),
    link_preview: readStoredPreview(row.link_preview),
    created_at: row.created_at.toISOString(),
    last_touched_at: row.last_touched_at.toISOString(),
    local_date: localDate,
    duration_seconds: row.duration_seconds,
  };
}

export async function createItem(req: Request, res: Response) {
  const parsed = createItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: issueMessage(req, parsed.error.issues) });
    return;
  }

  const user = readSignedInUser(res);
  // A refused or failed preview still saves the link. content stays the URL.
  const linkPreview = parsed.data.type === "link" ? await fetchLinkPreview(parsed.data.content) : null;
  const note = parsed.data.type === "link" ? (parsed.data.note ?? null) : null;
  // One clock read so last_touched_at matches created_at. Reads do not move it later.
  const now = new Date();
  const item = await prisma.item.create({
    data: {
      user_id: user.id,
      type: parsed.data.type,
      content: parsed.data.content,
      note,
      status: "inbox",
      link_preview: linkPreview === null ? Prisma.DbNull : linkPreview,
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
    res.status(400).json({ error: issueMessage(req, parsed.error.issues) });
    return;
  }

  let cursor: { createdAt: Date; id: string } | null = null;
  const cursorValue = parsed.data.cursor;
  if (cursorValue) {
    cursor = readCursor(cursorValue);
    if (!cursor) {
      res.status(400).json({ error: msg(req, BAD_CURSOR) });
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
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  const item = await prisma.item.findFirst({
    where: { id, user_id: user.id },
    select: itemSelect,
  });
  if (!item) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  res.json(toItem(item, user));
}

export async function updateItem(req: Request, res: Response) {
  const parsed = updateItemSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: issueMessage(req, parsed.error.issues) });
    return;
  }

  const user = readSignedInUser(res);
  const id = paramId(req);
  if (!id) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  const item = await prisma.item.findFirst({
    where: { id, user_id: user.id },
    select: itemSelect,
  });
  if (!item) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  let nextContent = item.content;
  let contentChanged = false;
  if (parsed.data.content !== undefined) {
    if (item.type === "voice" || item.type === "image") {
      res.status(400).json({ error: msg(req, CONTENT_LOCKED) });
      return;
    }
    if (item.type === "text") {
      const text = textContentSchema.safeParse(parsed.data.content);
      if (!text.success) {
        res.status(400).json({ error: issueMessage(req, text.error.issues) });
        return;
      }
      nextContent = text.data;
    }
    if (item.type === "link") {
      const link = linkContentSchema.safeParse(parsed.data.content);
      if (!link.success) {
        res.status(400).json({ error: issueMessage(req, link.error.issues) });
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
        res.status(400).json({ error: msg(req, BAD_CATEGORY) });
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
          res.status(400).json({ error: msg(req, BAD_TAG) });
          return;
        }
      }
      nextTagIds = requested;
      tagsChanged = true;
    }
  }

  let nextNote = item.note;
  let noteChanged = false;
  if (parsed.data.note !== undefined && parsed.data.note !== item.note) {
    nextNote = parsed.data.note;
    noteChanged = true;
  }

  const touched = contentChanged || statusChanged || categoryChanged || tagsChanged || noteChanged;
  if (!touched) {
    res.json(toItem(item, user));
    return;
  }

  // Fetch before the transaction so a slow page does not hold the database open.
  let nextPreview: LinkPreview | null = null;
  if (contentChanged && item.type === "link") {
    nextPreview = await fetchLinkPreview(nextContent);
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
      link_preview?: LinkPreview | typeof Prisma.DbNull;
      note?: string | null;
      last_touched_at: Date;
    } = {
      last_touched_at: now,
    };
    if (contentChanged) {
      data.content = nextContent;
      if (item.type === "link") {
        data.link_preview = nextPreview ?? Prisma.DbNull;
      }
    }
    if (statusChanged) {
      data.status = nextStatus;
    }
    if (categoryChanged) {
      data.category_id = nextCategoryId;
    }
    if (noteChanged) {
      data.note = nextNote;
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
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  res.json(toItem(saved, user));
}

export async function deleteItem(req: Request, res: Response) {
  const user = readSignedInUser(res);
  const id = paramId(req);
  if (!id) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  const existing = await prisma.item.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
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

export async function listRevival(_req: Request, res: Response) {
  const user = readSignedInUser(res);
  const cutoff = new Date(Date.now() - STALE_MS);
  // Reading this list is not a touch. Nothing here writes last_touched_at.
  const rows = await prisma.item.findMany({
    where: {
      user_id: user.id,
      status: { in: ["inbox", "active"] },
      last_touched_at: { lt: cutoff },
    },
    orderBy: [{ last_touched_at: "asc" }, { id: "asc" }],
    select: itemSelect,
  });

  res.json({ items: rows.map((row) => toItem(row, user)) });
}

export async function reviveItem(req: Request, res: Response) {
  const user = readSignedInUser(res);
  const id = paramId(req);
  if (!id) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  const item = await prisma.item.findFirst({
    where: { id, user_id: user.id },
    select: { id: true },
  });
  if (!item) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  const now = new Date();
  // Revive is a touch. created_at and status are not in this update, so they stay.
  const saved = await prisma.item.update({
    where: { id: item.id },
    data: { last_touched_at: now },
    select: itemSelect,
  });

  res.json(toItem(saved, user));
}

type VoiceKind = {
  extension: "webm" | "ogg";
  contentType: "audio/webm" | "audio/ogg";
};

// Chrome sends audio/webm;codecs=opus. The part before ";" is the type we store.
function voiceKind(mime: string): VoiceKind | null {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "audio/webm") {
    return { extension: "webm", contentType: "audio/webm" };
  }
  if (base === "audio/ogg") {
    return { extension: "ogg", contentType: "audio/ogg" };
  }
  return null;
}

function contentTypeFromKey(key: string): string | null {
  if (key.endsWith(".webm")) {
    return "audio/webm";
  }
  if (key.endsWith(".ogg")) {
    return "audio/ogg";
  }
  if (key.endsWith(".jpg")) {
    return "image/jpeg";
  }
  if (key.endsWith(".png")) {
    return "image/png";
  }
  if (key.endsWith(".webp")) {
    return "image/webp";
  }
  if (key.endsWith(".gif")) {
    return "image/gif";
  }
  return null;
}

type VoiceFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
};

function readVoiceFile(req: Request): VoiceFile | undefined {
  // multer puts the audio part on req.file. Express does not know that field.
  const withFile = req as Request & { file?: VoiceFile };
  const file = withFile.file;
  if (!file || !Buffer.isBuffer(file.buffer) || typeof file.mimetype !== "string") {
    return undefined;
  }
  return file;
}

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: VOICE_MAX_BYTES,
    files: 1,
  },
}).single("audio");

export function postVoiceItem(req: Request, res: Response) {
  voiceUpload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: msg(req, VOICE_TOO_BIG) });
      return;
    }
    if (error) {
      res.status(400).json({ error: msg(req, VOICE_BAD) });
      return;
    }
    void createVoiceItem(req, res).catch((failure: unknown) => {
      console.error(failure);
      if (!res.headersSent) {
        res.status(500).json({ error: msg(req, SERVER_ERROR) });
      }
    });
  });
}

async function createVoiceItem(req: Request, res: Response) {
  const file = readVoiceFile(req);
  if (!file || file.size === 0 || file.buffer.length === 0) {
    res.status(400).json({ error: msg(req, VOICE_EMPTY) });
    return;
  }
  // Reject the whole clip. Do not keep a 15 MB piece of a larger upload.
  if (file.size > VOICE_MAX_BYTES || file.buffer.length > VOICE_MAX_BYTES) {
    res.status(400).json({ error: msg(req, VOICE_TOO_BIG) });
    return;
  }

  const kind = voiceKind(file.mimetype);
  if (!kind) {
    res.status(400).json({ error: msg(req, VOICE_TYPE) });
    return;
  }

  const duration = voiceDurationSchema.safeParse(req.body.duration_seconds);
  if (!duration.success) {
    res.status(400).json({ error: issueMessage(req, duration.error.issues) });
    return;
  }

  const noteInput = readOptionalNote(req, req.body.note);
  if (!noteInput.ok) {
    res.status(400).json({ error: noteInput.error });
    return;
  }

  const user = readSignedInUser(res);
  // The id is chosen here so the object key can be stored in the same insert.
  const id = randomUUID();
  const key = `${user.id}/${id}.${kind.extension}`;
  const now = new Date();
  await prisma.item.create({
    data: {
      id,
      user_id: user.id,
      type: "voice",
      content: key,
      note: noteInput.note,
      status: "inbox",
      category_id: null,
      duration_seconds: duration.data,
      created_at: now,
      last_touched_at: now,
    },
  });

  try {
    await putPrivateObject(key, file.buffer, kind.contentType);
  } catch {
    await prisma.item.delete({ where: { id } }).catch(() => undefined);
    res.status(500).json({ error: msg(req, SERVER_ERROR) });
    return;
  }

  const saved = await prisma.item.findFirst({
    where: { id, user_id: user.id },
    select: itemSelect,
  });
  if (!saved) {
    res.status(500).json({ error: msg(req, SERVER_ERROR) });
    return;
  }

  res.status(201).json(toItem(saved, user));
}

type ImageKind = {
  extension: "jpg" | "png" | "webp" | "gif";
  contentType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
};

function imageKind(mime: string): ImageKind | null {
  const base = mime.split(";")[0]?.trim().toLowerCase() ?? "";
  const parsed = imageContentTypeSchema.safeParse(base);
  if (!parsed.success) {
    return null;
  }
  if (parsed.data === "image/jpeg") {
    return { extension: "jpg", contentType: "image/jpeg" };
  }
  if (parsed.data === "image/png") {
    return { extension: "png", contentType: "image/png" };
  }
  if (parsed.data === "image/webp") {
    return { extension: "webp", contentType: "image/webp" };
  }
  if (parsed.data === "image/gif") {
    return { extension: "gif", contentType: "image/gif" };
  }
  return null;
}

type ImageFile = {
  buffer: Buffer;
  size: number;
  mimetype: string;
};

function readImageFile(req: Request): ImageFile | undefined {
  const withFile = req as Request & { file?: ImageFile };
  const file = withFile.file;
  if (!file || !Buffer.isBuffer(file.buffer) || typeof file.mimetype !== "string") {
    return undefined;
  }
  return file;
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: IMAGE_MAX_BYTES,
    files: 1,
  },
}).single("image");

export function postImageItem(req: Request, res: Response) {
  imageUpload(req, res, (error: unknown) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(400).json({ error: msg(req, IMAGE_TOO_BIG) });
      return;
    }
    if (error) {
      res.status(400).json({ error: msg(req, IMAGE_BAD) });
      return;
    }
    void createImageItem(req, res).catch((failure: unknown) => {
      console.error(failure);
      if (!res.headersSent) {
        res.status(500).json({ error: msg(req, SERVER_ERROR) });
      }
    });
  });
}

async function createImageItem(req: Request, res: Response) {
  const file = readImageFile(req);
  if (!file || file.size === 0 || file.buffer.length === 0) {
    res.status(400).json({ error: msg(req, IMAGE_EMPTY) });
    return;
  }
  // Reject the whole file. Do not keep a 5 MB piece of a larger upload.
  if (file.size > IMAGE_MAX_BYTES || file.buffer.length > IMAGE_MAX_BYTES) {
    res.status(400).json({ error: msg(req, IMAGE_TOO_BIG) });
    return;
  }

  const kind = imageKind(file.mimetype);
  if (!kind) {
    res.status(400).json({ error: msg(req, IMAGE_TYPE) });
    return;
  }

  const noteInput = readOptionalNote(req, req.body.note);
  if (!noteInput.ok) {
    res.status(400).json({ error: noteInput.error });
    return;
  }

  const user = readSignedInUser(res);
  const id = randomUUID();
  const key = `${user.id}/${id}.${kind.extension}`;
  const now = new Date();
  try {
    await prisma.item.create({
      data: {
        id,
        user_id: user.id,
        type: "image",
        content: key,
        note: noteInput.note,
        status: "inbox",
        category_id: null,
        created_at: now,
        last_touched_at: now,
      },
    });
  } catch (failure: unknown) {
    console.error(failure);
    res.status(500).json({ error: msg(req, SERVER_ERROR) });
    return;
  }

  try {
    await putPrivateObject(key, file.buffer, kind.contentType);
  } catch {
    await removeRejectedImage(id, key);
    res.status(500).json({ error: msg(req, SERVER_ERROR) });
    return;
  }

  const saved = await prisma.item.findFirst({
    where: { id, user_id: user.id },
    select: itemSelect,
  });
  if (!saved) {
    await removeRejectedImage(id, key);
    res.status(500).json({ error: msg(req, SERVER_ERROR) });
    return;
  }

  res.status(201).json(toItem(saved, user));
}

// The note is removed first. The file is removed only after that row is gone.
async function removeRejectedImage(id: string, key: string) {
  await prisma.item.delete({ where: { id } }).catch(() => undefined);
  const stillThere = await prisma.item.findFirst({
    where: { id },
    select: { id: true },
  });
  if (!stillThere) {
    await deletePrivateObject(key).catch(() => undefined);
  }
}

export async function streamItemFile(req: Request, res: Response) {
  const user = readSignedInUser(res);
  const id = paramId(req);
  if (!id) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  // Same ownership check as the other item reads. This read does not touch the row.
  const item = await prisma.item.findFirst({
    where: { id, user_id: user.id },
    select: { type: true, content: true },
  });
  if (!item || (item.type !== "voice" && item.type !== "image")) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  const contentType = contentTypeFromKey(item.content);
  if (!contentType) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }
  if (item.type === "voice" && !contentType.startsWith("audio/")) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }
  if (item.type === "image" && !contentType.startsWith("image/")) {
    res.status(404).json({ error: msg(req, NOT_FOUND) });
    return;
  }

  let body: Awaited<ReturnType<typeof openPrivateObject>>;
  try {
    body = await openPrivateObject(item.content);
  } catch {
    res.status(500).json({ error: msg(req, SERVER_ERROR) });
    return;
  }

  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, no-store");
  body.on("error", () => {
    if (!res.headersSent) {
      res.status(500).json({ error: msg(req, SERVER_ERROR) });
      return;
    }
    res.destroy();
  });
  body.pipe(res);
}
