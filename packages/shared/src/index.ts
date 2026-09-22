export const APP_NAME = "ReviveNotes";

export { loginSchema, registerSchema } from "./auth.js";
export type { LoginInput, PublicUser, RegisterInput } from "./auth.js";
export { updateSettingsSchema } from "./settings.js";
export type { UpdateSettingsInput } from "./settings.js";
export { createItemSchema, itemListQuerySchema, LINK_MAX_LENGTH, TEXT_MAX_LENGTH } from "./items.js";
export type { CreateItemInput, Item, ItemListQuery, ItemPage } from "./items.js";
export { CATEGORY_COLORS, categorySchema, tagSchema } from "./labels.js";
export type { Category, CategoryColor, CategoryInput, Tag, TagInput } from "./labels.js";
