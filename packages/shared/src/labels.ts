import { z } from "zod";

export const CATEGORY_COLORS = [
  "red",
  "orange",
  "amber",
  "green",
  "teal",
  "blue",
  "violet",
  "pink",
] as const;

export type CategoryColor = (typeof CATEGORY_COLORS)[number];

const nameField = z
  .string({ error: "name_required" })
  .trim()
  .min(1, { error: "name_required" });

const categoryColorSchema = z.enum(CATEGORY_COLORS, {
  error: "color_invalid",
});

export const categorySchema = z.object({
  name: nameField,
  color: categoryColorSchema,
});

export const tagSchema = z.object({
  name: nameField,
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type TagInput = z.infer<typeof tagSchema>;

export type Category = {
  id: string;
  name: string;
  color: CategoryColor;
};

export type Tag = {
  id: string;
  name: string;
};
