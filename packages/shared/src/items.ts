import { z } from "zod";

export const TEXT_MAX_LENGTH = 10000;
export const LINK_MAX_LENGTH = 2000;

const ITEM_STATUSES = ["inbox", "active", "done", "archived"] as const;

const textItemSchema = z.object({
  type: z.literal("text"),
  content: z
    .string({ error: "اكتب الملاحظة" })
    .trim()
    .min(1, { error: "اكتب الملاحظة" })
    .max(TEXT_MAX_LENGTH, { error: `الملاحظة أطول من ${TEXT_MAX_LENGTH} حرف` }),
});

const linkItemSchema = z.object({
  type: z.literal("link"),
  content: z
    .string({ error: "اكتب الرابط" })
    .trim()
    .min(1, { error: "اكتب الرابط" })
    .max(LINK_MAX_LENGTH, { error: `الرابط أطول من ${LINK_MAX_LENGTH} حرف` })
    .pipe(z.url({ protocol: /^https?$/, error: "الرابط لازم يبدأ بـ http أو https" })),
});

export const createItemSchema = z.discriminatedUnion("type", [textItemSchema, linkItemSchema], {
  error: "اختار نص أو رابط",
});

export const itemListQuerySchema = z.object({
  status: z.enum(ITEM_STATUSES, { error: "الحالة مش معروفة" }).optional(),
  cursor: z.string({ error: "المؤشر مش مفهوم" }).trim().optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;
export type ItemListQuery = z.infer<typeof itemListQuerySchema>;

export type Item = {
  id: string;
  type: "link" | "text" | "voice" | "image";
  content: string;
  status: "inbox" | "active" | "done" | "archived";
  category_id: string | null;
  link_preview: null;
  created_at: string;
  last_touched_at: string;
};

export type ItemPage = {
  items: Item[];
  next_cursor: string | null;
};
