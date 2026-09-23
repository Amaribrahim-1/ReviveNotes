import { CATEGORY_COLORS, type CategoryColor, type Locale } from "@revivenotes/shared";
import { tUi } from "@/lib/ui-copy";

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

const colorKey = {
  red: "color_red",
  orange: "color_orange",
  amber: "color_amber",
  green: "color_green",
  teal: "color_teal",
  blue: "color_blue",
  violet: "color_violet",
  pink: "color_pink",
} as const;

export function categoryColorLabel(locale: Locale, color: CategoryColor): string {
  return tUi(locale, colorKey[color]);
}

export function knownCategoryColor(color: string): CategoryColor | null {
  for (const item of CATEGORY_COLORS) {
    if (item === color) {
      return item;
    }
  }
  return null;
}
