import { z } from "zod";

export const TEXT_MAX_LENGTH = 10000;
export const LINK_MAX_LENGTH = 2000;

export const ITEM_STATUSES = ["inbox", "active", "done", "archived"] as const;

export type ItemStatus = (typeof ITEM_STATUSES)[number];

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

export const itemListQuerySchema = z.object({
  status: z.enum(ITEM_STATUSES, { error: "الحالة مش معروفة" }).optional(),
  cursor: z.string({ error: "المؤشر مش مفهوم" }).trim().optional(),
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

export type Item = {
  id: string;
  type: "link" | "text" | "voice" | "image";
  content: string;
  status: ItemStatus;
  category_id: string | null;
  tag_ids: string[];
  link_preview: null;
  created_at: string;
  last_touched_at: string;
  local_date: string;
};

export type ItemPage = {
  items: Item[];
  next_cursor: string | null;
};
