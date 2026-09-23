import { z } from "zod";

export const TEXT_MAX_LENGTH = 10000;
export const LINK_MAX_LENGTH = 2000;
export const VOICE_MAX_SECONDS = 600;
export const VOICE_MAX_BYTES = 15 * 1024 * 1024;

export const ITEM_STATUSES = ["inbox", "active", "done", "archived"] as const;
export const ITEM_TYPES = ["link", "text", "voice", "image"] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];
export type ItemType = (typeof ITEM_TYPES)[number];

export const textContentSchema = z
  .string({ error: "اكتب الملاحظة" })
  .trim()
  .min(1, { error: "اكتب الملاحظة" })
  .max(TEXT_MAX_LENGTH, { error: `الملاحظة أطول من ${TEXT_MAX_LENGTH} حرف` });

export const linkContentSchema = z
  .string({ error: "اكتب الرابط" })
  .trim()
  .min(1, { error: "اكتب الرابط" })
  .max(LINK_MAX_LENGTH, { error: `الرابط أطول من ${LINK_MAX_LENGTH} حرف` })
  .pipe(z.url({ protocol: /^https?$/, error: "الرابط لازم يبدأ بـ http أو https" }));

const textItemSchema = z.object({
  type: z.literal("text"),
  content: textContentSchema,
});

const linkItemSchema = z.object({
  type: z.literal("link"),
  content: linkContentSchema,
});

export const createItemSchema = z.discriminatedUnion("type", [textItemSchema, linkItemSchema], {
  error: "اختار نص أو رابط",
});

// The multipart field arrives as text. 0 through 600 are accepted. 601 is not.
export const voiceDurationSchema = z
  .string({ error: "مدة التسجيل مش مظبوطة" })
  .trim()
  .regex(/^\d{1,3}$/, { error: "مدة التسجيل مش مظبوطة" })
  .transform((value) => Number(value))
  .refine((value) => value <= VOICE_MAX_SECONDS, { error: "التسجيل أطول من 10 دقايق" });

const tagIdSchema = z
  .string({ error: "الوسم مش موجود" })
  .trim()
  .min(1, { error: "الوسم مش موجود" });

// One `tag` value arrives as a string. Repeated `tag` values arrive as an array.
// Missing `tag` stays missing, so the list does not filter by tags.
const tagQuerySchema = z.union([tagIdSchema, z.array(tagIdSchema)], {
  error: "الوسم مش موجود",
});

export const itemListQuerySchema = z
  .object({
    status: z.enum(ITEM_STATUSES, { error: "الحالة مش معروفة" }).optional(),
    type: z.enum(ITEM_TYPES, { error: "النوع مش معروف" }).optional(),
    category_id: z
      .string({ error: "التصنيف مش موجود" })
      .trim()
      .min(1, { error: "التصنيف مش موجود" })
      .optional(),
    tag: tagQuerySchema.optional(),
    cursor: z.string({ error: "المؤشر مش مفهوم" }).trim().optional(),
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
    .string({ error: "اكتب المحتوى" })
    .trim()
    .min(1, { error: "اكتب المحتوى" })
    .max(TEXT_MAX_LENGTH, { error: `المحتوى أطول من ${TEXT_MAX_LENGTH} حرف` })
    .optional(),
  status: z.enum(ITEM_STATUSES, { error: "الحالة مش معروفة" }).optional(),
  category_id: z
    .string({ error: "التصنيف مش موجود" })
    .trim()
    .min(1, { error: "التصنيف مش موجود" })
    .nullable()
    .optional(),
  tag_ids: z
    .array(z.string({ error: "الوسم مش موجود" }).trim().min(1, { error: "الوسم مش موجود" }), {
      error: "الوسوم مش مظبوطة",
    })
    .optional(),
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
