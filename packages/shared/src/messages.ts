export type Locale = "ar" | "en";

export const DEFAULT_LOCALE: Locale = "ar";

/**
 * Shared API and Zod messages. English stays short and plain.
 * Zod schemas store the key string; callers translate with `tMsg`.
 */
export const MSG = {
  bad_data: { ar: "البيانات مش مظبوطة", en: "Check your data" },
  generic_error: { ar: "حصل خطأ. حاول تاني.", en: "Something went wrong. Try again." },
  server_error: { ar: "حصل خطأ في السيرفر", en: "Server error" },
  offline: { ar: "مش قادرين نوصل للسيرفر", en: "Cannot reach the server" },

  email_required: { ar: "اكتب البريد", en: "Enter your email" },
  email_invalid: { ar: "البريد مش صحيح", en: "Email is not valid" },
  password_required: { ar: "اكتب كلمة السر", en: "Enter your password" },
  password_min: { ar: "كلمة السر لازم تكون 8 حروف على الأقل", en: "Password needs at least 8 characters" },
  password_too_long: { ar: "كلمة السر أطول من المسموح", en: "Password is too long" },
  timezone_required: { ar: "المنطقة الزمنية ناقصة", en: "Time zone is missing" },
  timezone_pick: { ar: "اختار المنطقة الزمنية", en: "Pick a time zone" },
  timezone_invalid: { ar: "المنطقة الزمنية مش صحيحة", en: "Time zone is not valid" },
  login_failed: { ar: "البريد أو كلمة السر غير صحيحة", en: "Email or password is wrong" },
  email_in_use: { ar: "البريد مستخدم بالفعل", en: "This email is already used" },
  too_many_attempts: {
    ar: "محاولات كتير. استنى شوية وحاول تاني.",
    en: "Too many tries. Wait a bit and try again.",
  },
  login_required: { ar: "لازم تسجل دخول", en: "Please sign in" },

  name_required: { ar: "اكتب الاسم", en: "Enter a name" },
  color_invalid: { ar: "اختار لون من الألوان المتاحة", en: "Pick a color from the list" },
  name_taken: { ar: "الاسم ده موجود عندك", en: "You already have this name" },
  not_found: { ar: "مش موجود", en: "Not found" },

  hour_invalid: { ar: "اختار ساعة من 0 لـ 23", en: "Pick an hour from 0 to 23" },
  reminder_times_invalid: { ar: "اختار من 1 لـ 3 أوقات مختلفة", en: "Pick 1 to 3 different times" },

  note_required: { ar: "اكتب الملاحظة", en: "Write a note" },
  note_too_long: { ar: "الملاحظة أطول من 10000 حرف", en: "Note is too long (max 10000)" },
  link_required: { ar: "اكتب الرابط", en: "Enter a link" },
  link_too_long: { ar: "الرابط أطول من 2000 حرف", en: "Link is too long (max 2000)" },
  link_protocol: { ar: "الرابط لازم يبدأ بـ http أو https", en: "Link must start with http or https" },
  note_invalid: { ar: "الملاحظة مش مظبوطة", en: "Note is not valid" },
  pick_text_or_link: { ar: "اختار نص أو رابط", en: "Pick text or link" },
  voice_duration_invalid: { ar: "مدة التسجيل مش مظبوطة", en: "Recording time is not valid" },
  voice_too_long: { ar: "التسجيل أطول من 10 دقايق", en: "Recording is longer than 10 minutes" },
  image_type: {
    ar: "نوع الصورة لازم يكون jpeg أو png أو webp أو gif",
    en: "Image must be jpeg, png, webp, or gif",
  },
  tag_missing: { ar: "الوسم مش موجود", en: "Tag not found" },
  status_unknown: { ar: "الحالة مش معروفة", en: "Unknown status" },
  type_unknown: { ar: "النوع مش معروف", en: "Unknown type" },
  category_missing: { ar: "التصنيف مش موجود", en: "Category not found" },
  cursor_invalid: { ar: "المؤشر مش مفهوم", en: "Bad page marker" },
  content_required: { ar: "اكتب المحتوى", en: "Enter the content" },
  content_too_long: { ar: "المحتوى أطول من 10000 حرف", en: "Content is too long (max 10000)" },
  tags_invalid: { ar: "الوسوم مش مظبوطة", en: "Tags are not valid" },
  content_locked: { ar: "مش ممكن تعدل المحتوى ده", en: "You cannot edit this content" },
  voice_too_big: { ar: "التسجيل أكبر من 15 ميجا", en: "Recording is larger than 15 MB" },
  voice_empty: { ar: "التسجيل فاضي", en: "Recording is empty" },
  voice_type: { ar: "نوع التسجيل لازم يكون webm أو ogg", en: "Recording must be webm or ogg" },
  voice_bad: { ar: "التسجيل مش مظبوط", en: "Recording is not valid" },
  image_too_big: { ar: "الصورة أكبر من 5 ميجا", en: "Image is larger than 5 MB" },
  image_empty: { ar: "الصورة فاضية", en: "Image is empty" },
  image_bad: { ar: "الصورة مش مظبوطة", en: "Image is not valid" },
  push_vapid_missing: { ar: "مفتاح الإشعار ناقص", en: "Push key is missing" },
  cron_secret_invalid: { ar: "السر مش صحيح", en: "Secret is wrong" },
  push_endpoint_required: { ar: "عنوان الاشتراك ناقص", en: "Subscription URL is missing" },
  push_endpoint_invalid: { ar: "عنوان الاشتراك مش صحيح", en: "Subscription URL is not valid" },
  push_p256dh_required: { ar: "مفتاح الاشتراك ناقص", en: "Subscription key is missing" },
  push_auth_required: { ar: "سر الاشتراك ناقص", en: "Subscription secret is missing" },
} as const;

export type MsgKey = keyof typeof MSG;

export function isMsgKey(value: string): value is MsgKey {
  return Object.prototype.hasOwnProperty.call(MSG, value);
}

export function parseLocale(header: string | undefined | null): Locale {
  if (!header) {
    return DEFAULT_LOCALE;
  }
  const first = header.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("en")) {
    return "en";
  }
  return DEFAULT_LOCALE;
}

export function tMsg(locale: Locale, key: string): string {
  if (isMsgKey(key)) {
    return MSG[key][locale];
  }
  return MSG.bad_data[locale];
}

export function zodErrorMessage(issues: { message: string }[], locale: Locale): string {
  const key = issues[0]?.message;
  if (!key) {
    return tMsg(locale, "bad_data");
  }
  return tMsg(locale, key);
}
