import { z } from "zod";

export const TEXT_MAX_LENGTH = 10000;
export const LINK_MAX_LENGTH = 2000;
export const VOICE_MAX_SECONDS = 600;
export const VOICE_MAX_BYTES = 15 * 1024 * 1024;
// A photo cap. The voice cap above is a different number and stays 15 MB.
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

export const ITEM_STATUSES = ["inbox", "active", "done", "archived"] as const;
export const ITEM_TYPES = ["link", "text", "voice", "image"] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type ItemType = (typeof ITEM_TYPES)[number];

export const textContentSchema = z
  .string({ error: "note_required" })
  .trim()
  .min(1, { error: "note_required" })
  .max(TEXT_MAX_LENGTH, { error: "note_too_long" });

export const linkContentSchema = z
  .string({ error: "link_required" })
  .trim()
  .min(1, { error: "link_required" })
  .max(LINK_MAX_LENGTH, { error: "link_too_long" })
  .pipe(z.url({ protocol: /^https?$/, error: "link_protocol" }));

// Empty and whitespace become null. The words never go into content.
export const itemNoteSchema = z
  .string({ error: "note_invalid" })
  .trim()
  .max(TEXT_MAX_LENGTH, { error: "note_too_long" })
  .transform((value) => (value.length === 0 ? null : value));

const textItemSchema = z.object({
  type: z.literal("text"),
  content: textContentSchema,
});

const linkItemSchema = z.object({
  type: z.literal("link"),
  content: linkContentSchema,
  note: itemNoteSchema.optional(),
});

export const createItemSchema = z.discriminatedUnion("type", [textItemSchema, linkItemSchema], {
  error: "pick_text_or_link",
});

// The multipart field arrives as text. 0 through 600 are accepted. 601 is not.
export const voiceDurationSchema = z
  .string({ error: "voice_duration_invalid" })
  .trim()
  .regex(/^\d{1,3}$/, { error: "voice_duration_invalid" })
  .transform((value) => Number(value))
  .refine((value) => value <= VOICE_MAX_SECONDS, { error: "voice_too_long" });

export const imageContentTypeSchema = z.enum(IMAGE_CONTENT_TYPES, {
  error: "image_type",
});

const tagIdSchema = z
  .string({ error: "tag_missing" })
  .trim()
  .min(1, { error: "tag_missing" });

// One `tag` value arrives as a string. Repeated `tag` values arrive as an array.
// Missing `tag` stays missing, so the list does not filter by tags.
const tagQuerySchema = z.union([tagIdSchema, z.array(tagIdSchema)], {
  error: "tag_missing",
});

export const itemListQuerySchema = z
  .object({
    status: z.enum(ITEM_STATUSES, { error: "status_unknown" }).optional(),
    type: z.enum(ITEM_TYPES, { error: "type_unknown" }).optional(),
    category_id: z
      .string({ error: "category_missing" })
      .trim()
      .min(1, { error: "category_missing" })
      .optional(),
    tag: tagQuerySchema.optional(),
    cursor: z.string({ error: "cursor_invalid" }).trim().optional(),
  })
  .transform((query) => {
    const tag = query.tag;
    return {
      status: query.status,
      type: query.type,
      category_id: query.category_id,
      cursor: query.cursor,
      tag: tag === undefined ? undefined : Array.isArray(tag) ? tag : [tag],
    };
  });

// Every field is optional. tag_ids, when sent, is the full set for that item.
export const updateItemSchema = z.object({
  content: z
    .string({ error: "content_required" })
    .trim()
    .min(1, { error: "content_required" })
    .max(TEXT_MAX_LENGTH, { error: "content_too_long" })
    .optional(),
  status: z.enum(ITEM_STATUSES, { error: "status_unknown" }).optional(),
  category_id: z
    .string({ error: "category_missing" })
    .trim()
    .min(1, { error: "category_missing" })
    .nullable()
    .optional(),
  tag_ids: z
    .array(z.string({ error: "tag_missing" }).trim().min(1, { error: "tag_missing" }), {
      error: "tags_invalid",
    })
    .optional(),
  note: z.union([itemNoteSchema, z.null()]).optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type ItemListQuery = z.infer<typeof itemListQuerySchema>;
export type UpdateItemInput = z.infer<typeof updateItemSchema>;

// Written by the API after a link fetch. The client does not send this object.
export const linkPreviewSchema = z.object({
  site_name: z.string().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
});

export type LinkPreview = z.infer<typeof linkPreviewSchema>;

export type Item = {
  id: string;
  type: ItemType;
  content: string;
  note: string | null;
  status: ItemStatus;
  category_id: string | null;
  tag_ids: string[];
  link_preview: LinkPreview | null;
  created_at: string;
  last_touched_at: string;
  local_date: string;
  duration_seconds: number | null;
};

export type ItemPage = {
  items: Item[];
  next_cursor: string | null;
};

export type RevivalList = {
  items: Item[];
};
