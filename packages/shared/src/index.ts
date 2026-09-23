export const APP_NAME = "ReviveNotes";

export {
  DEFAULT_LOCALE,
  isMsgKey,
  MSG,
  parseLocale,
  tMsg,
  zodErrorMessage,
} from "./messages.js";
export type { Locale, MsgKey } from "./messages.js";
export { loginSchema, registerSchema } from "./auth.js";
export type { LoginInput, PublicUser, RegisterInput } from "./auth.js";
export { pushSubscriptionSchema } from "./push.js";
export type { PushSubscriptionInput } from "./push.js";
export { updateSettingsSchema } from "./settings.js";
export type { UpdateSettingsInput } from "./settings.js";
export {
  createItemSchema,
  IMAGE_CONTENT_TYPES,
  IMAGE_MAX_BYTES,
  imageContentTypeSchema,
  ITEM_STATUSES,
  ITEM_TYPES,
  itemListQuerySchema,
  itemNoteSchema,
  linkContentSchema,
  linkPreviewSchema,
  LINK_MAX_LENGTH,
  textContentSchema,
  TEXT_MAX_LENGTH,
  updateItemSchema,
  VOICE_MAX_BYTES,
  VOICE_MAX_SECONDS,
  voiceDurationSchema,
} from "./items.js";
export type {
  CreateItemInput,
  Item,
  ItemListQuery,
  LinkPreview,
  ItemPage,
  ItemStatus,
  ItemType,
  RevivalList,
  UpdateItemInput,
} from "./items.js";
export { CATEGORY_COLORS, categorySchema, tagSchema } from "./labels.js";
export type { Category, CategoryColor, CategoryInput, Tag, TagInput } from "./labels.js";
export type { TodayProgress } from "./progress.js";
