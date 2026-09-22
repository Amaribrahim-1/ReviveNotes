import { CATEGORY_COLORS, type CategoryColor } from "@revivenotes/shared";

export const categoryColorClass: Record<CategoryColor, string> = {
  red: "bg-red-500",
  orange: "bg-orange-500",
  amber: "bg-amber-500",
  green: "bg-green-500",
  teal: "bg-teal-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
  pink: "bg-pink-500",
};

export const categoryColorLabel: Record<CategoryColor, string> = {
  red: "أحمر",
  orange: "برتقالي",
  amber: "ذهبي",
  green: "أخضر",
  teal: "تركوازي",
  blue: "أزرق",
  violet: "بنفسجي",
  pink: "وردي",
};

export function knownCategoryColor(color: string): CategoryColor | null {
  for (const item of CATEGORY_COLORS) {
    if (item === color) {
      return item;
    }
  }
  return null;
}
