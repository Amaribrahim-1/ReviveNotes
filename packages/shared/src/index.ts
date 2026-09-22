export const APP_NAME = "ReviveNotes";

export { loginSchema, registerSchema } from "./auth.js";
export type { LoginInput, PublicUser, RegisterInput } from "./auth.js";
export { CATEGORY_COLORS, categorySchema, tagSchema } from "./labels.js";
export type { Category, CategoryColor, CategoryInput, Tag, TagInput } from "./labels.js";
