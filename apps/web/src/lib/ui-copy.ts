import type { Locale } from "@revivenotes/shared";
import { DEFAULT_LOCALE } from "@revivenotes/shared";

/**
 * Screen labels and toasts. English stays short and plain.
 */
export const UI = {
  app_name: { ar: "ريفايف نوتس", en: "ReviveNotes" },
  app_tagline: { ar: "ملاحظات بترجع", en: "Notes that come back" },
  app_blurb: {
    ar: "سجّل اللي عالق في راسك، ورجّعه للحياة قبل ما ينسى.",
    en: "Save what is in your head. Bring it back before you forget.",
  },
  app_meta: {
    ar: "ريفايف نوتس — رجّع ملاحظاتك للحياة",
    en: "ReviveNotes — bring your notes back",
  },

  nav_inbox: { ar: "الوارد", en: "Inbox" },
  nav_all: { ar: "الكل", en: "All" },
  nav_categories: { ar: "تصنيفات", en: "Categories" },
  nav_settings: { ar: "إعدادات", en: "Settings" },
  nav_label: { ar: "التنقل", en: "Navigation" },
  home_link: { ar: "الصفحة الرئيسية", en: "Home" },
  or_go_to: { ar: "أو روح على", en: "Or go to" },
  if_already_in: { ar: "لو أنت داخل أصلاً.", en: "if you are already signed in." },

  login: { ar: "دخول", en: "Sign in" },
  register: { ar: "حساب جديد", en: "Sign up" },
  register_submit: { ar: "تسجيل", en: "Sign up" },
  have_account: { ar: "عندك حساب؟ ادخل", en: "Have an account? Sign in" },
  logout: { ar: "خروج", en: "Log out" },
  email: { ar: "البريد", en: "Email" },
  password: { ar: "كلمة السر", en: "Password" },
  signing_in: { ar: "بندخل...", en: "Signing in..." },
  registering: { ar: "بنسجل...", en: "Signing up..." },
  signed_in: { ar: "اتسجل دخولك", en: "Signed in" },
  account_created: { ar: "اتعمل الحساب", en: "Account created" },
  check_data: { ar: "راجع البيانات", en: "Check your data" },

  theme_to_light: { ar: "الوضع الفاتح", en: "Light mode" },
  theme_to_dark: { ar: "الوضع الداكن", en: "Dark mode" },
  theme_light: { ar: "فاتح", en: "Light" },
  theme_dark: { ar: "داكن", en: "Dark" },
  lang_to_en: { ar: "English", en: "English" },
  lang_to_ar: { ar: "عربي", en: "عربي" },

  confirming_session: { ar: "بنأكد الجلسة...", en: "Checking session..." },
  redirecting_login: { ar: "بنحوّلك على صفحة الدخول...", en: "Going to sign in..." },
  offline: { ar: "مش قادرين نوصل للسيرفر", en: "Cannot reach the server" },
  try_again: { ar: "حاول تاني", en: "Try again" },
  generic_error: { ar: "حصل خطأ. حاول تاني.", en: "Something went wrong. Try again." },

  progress_cleared: { ar: "خلّصت النهارده", en: "Done today" },
  progress_error: { ar: "مش قادرين نجيب العدّاد", en: "Cannot load today's count" },

  share_holding_login: {
    ar: "فيه رابط مستني. هيتحفظ في الوارد بعد الدخول.",
    en: "A link is waiting. It will save to Inbox after you sign in.",
  },
  share_holding_register: {
    ar: "فيه رابط مستني. هيتحفظ في الوارد بعد التسجيل.",
    en: "A link is waiting. It will save to Inbox after you sign up.",
  },
  share_login_retry: {
    ar: "الدخول تم، والرابط لسه محفوظ. اضغط دخول تاني عشان نسجله.",
    en: "Signed in, but the link is still waiting. Sign in again to save it.",
  },
  share_register_retry: {
    ar: "التسجيل تم، والرابط لسه محفوظ. اضغط تسجيل تاني عشان نسجله.",
    en: "Signed up, but the link is still waiting. Sign up again to save it.",
  },
  share_title: { ar: "مشاركة رابط", en: "Share a link" },
  share_saving: { ar: "بنحفظ الرابط...", en: "Saving link..." },
  share_saved: { ar: "اتحفظ الرابط", en: "Link saved" },
  share_failed: { ar: "مش قدرنا نحفظ الرابط.", en: "Could not save the link." },
  share_need_login: {
    ar: "هنحوّلك على الدخول عشان نحفظ الرابط",
    en: "Going to sign in so we can save the link",
  },
  share_no_link: {
    ar: "مفيش رابط. النص والصورة مش بيتسجلوا.",
    en: "No link found. Text and images are not saved this way.",
  },
  share_bad_link: {
    ar: "الرابط لازم يبدأ بـ http أو https.",
    en: "Link must start with http or https.",
  },

  inbox_title: { ar: "الوارد", en: "Inbox" },
  inbox_empty_hint: {
    ar: "تقدر تسجّل الملاحظة من غير تصنيف.",
    en: "You can save a note without a category.",
  },
  all_items_title: { ar: "كل الملاحظات", en: "All notes" },
  categories_title: { ar: "التصنيفات والوسوم", en: "Categories and tags" },
  settings_title: { ar: "الإعدادات", en: "Settings" },

  type_text: { ar: "نص", en: "Text" },
  type_link: { ar: "رابط", en: "Link" },
  type_voice: { ar: "صوت", en: "Voice" },
  type_image: { ar: "صورة", en: "Image" },
  type_label: { ar: "النوع", en: "Type" },
  type_unknown: { ar: "النوع ده لسه مش متاح.", en: "This type is not ready yet." },

  status_label: { ar: "الحالة", en: "Status" },
  status_inbox: { ar: "الوارد", en: "Inbox" },
  status_active: { ar: "هشتغل عليها", en: "Working on it" },
  status_done: { ar: "خلصت", en: "Done" },
  status_archived: { ar: "أرشيف", en: "Archive" },
  filter_all: { ar: "الكل", en: "All" },
  no_category: { ar: "من غير تصنيف", en: "No category" },

  category: { ar: "التصنيف", en: "Category" },
  categories: { ar: "التصنيفات", en: "Categories" },
  tags: { ar: "الوسوم", en: "Tags" },
  tag_legend: { ar: "الوسوم", en: "Tags" },
  name: { ar: "الاسم", en: "Name" },
  color: { ar: "اللون", en: "Color" },
  note: { ar: "الملاحظة", en: "Note" },
  note_optional: { ar: "ملاحظة (اختياري)", en: "Note (optional)" },
  link: { ar: "الرابط", en: "Link" },
  content: { ar: "المحتوى", en: "Content" },

  save: { ar: "حفظ", en: "Save" },
  saving: { ar: "بنحفظ...", en: "Saving..." },
  saved: { ar: "اتحفظت", en: "Saved" },
  settings_saved: { ar: "اتحفظت الإعدادات", en: "Settings saved" },
  add: { ar: "إضافة", en: "Add" },
  adding: { ar: "بنضيف...", en: "Adding..." },
  add_category: { ar: "إضافة تصنيف", en: "Add category" },
  add_tag: { ar: "إضافة وسم", en: "Add tag" },
  category_added: { ar: "اتضاف التصنيف", en: "Category added" },
  tag_added: { ar: "اتضاف الوسم", en: "Tag added" },
  category_saved: { ar: "اتحفظ التصنيف", en: "Category saved" },
  tag_saved: { ar: "اتحفظ الوسم", en: "Tag saved" },
  category_deleted: { ar: "اتحذف التصنيف", en: "Category deleted" },
  tag_deleted: { ar: "اتحذف الوسم", en: "Tag deleted" },
  edit: { ar: "تعديل", en: "Edit" },
  delete: { ar: "حذف", en: "Delete" },
  deleting: { ar: "بنحذف...", en: "Deleting..." },
  cancel: { ar: "إلغاء", en: "Cancel" },
  confirm_delete: { ar: "تأكيد الحذف", en: "Confirm delete" },
  delete_forever: { ar: "حذف نهائي", en: "Delete forever" },
  delete_forever_warn: {
    ar: "الحذف نهائي والملاحظة مش هترجع.",
    en: "This delete is final. The note will not come back.",
  },
  delete_category_confirm: {
    ar: "حذف التصنيف ده؟ العناصر هتفضل من غير تصنيف.",
    en: "Delete this category? Notes stay, with no category.",
  },
  delete_tag_confirm: {
    ar: "حذف الوسم ده؟ العناصر هتفضل.",
    en: "Delete this tag? Notes stay.",
  },
  deleted: { ar: "اتحذفت", en: "Deleted" },
  no_categories_yet: { ar: "لسه مفيش تصنيفات.", en: "No categories yet." },
  no_tags_yet: { ar: "لسه مفيش وسوم.", en: "No tags yet." },
  loading_categories: { ar: "بنحمّل التصنيفات...", en: "Loading categories..." },
  loading_tags: { ar: "بنحمّل الوسوم...", en: "Loading tags..." },
  loading_items: { ar: "بنحمّل الملاحظات...", en: "Loading notes..." },
  loading_image: { ar: "بنحمّل الصورة...", en: "Loading image..." },
  loading: { ar: "بنحمّل...", en: "Loading..." },
  show_more: { ar: "اعرض المزيد", en: "Show more" },
  no_filter_matches: {
    ar: "مفيش ملاحظات بالفلاتر دي.",
    en: "No notes match these filters.",
  },

  revival_title: { ar: "ملاحظات قديمة", en: "Old notes" },
  revival_blurb: {
    ar: "الملاحظات دي عدّى عليها أكتر من 7 أيام من غير لمسة. إحياءها أو احذفها عشان تكمل.",
    en: "These notes had no touch for more than 7 days. Revive or delete them to continue.",
  },
  revival_checking: { ar: "بنشوف الملاحظات القديمة...", en: "Checking old notes..." },
  revival_error: { ar: "مش قادرين نجيب الملاحظات القديمة", en: "Cannot load old notes" },
  revive: { ar: "إحياء", en: "Revive" },
  reviving: { ar: "بنحيي...", en: "Reviving..." },
  revived: { ar: "اتحييت", en: "Revived" },

  capture_text: { ar: "نص", en: "Text" },
  capture_link: { ar: "رابط", en: "Link" },
  capture_voice: { ar: "صوت", en: "Voice" },
  capture_image: { ar: "صورة", en: "Image" },
  capture_save: { ar: "سجّل", en: "Save" },
  pick_image: { ar: "اختار صورة", en: "Pick an image" },
  image_note_alt: { ar: "صورة الملاحظة", en: "Note image" },
  open_image: { ar: "فتح صورة الملاحظة", en: "Open note image" },
  image_load_error: { ar: "مش قادرين نعرض الصورة", en: "Cannot show the image" },
  image_too_big: { ar: "الصورة أكبر من 5 ميجا", en: "Image is larger than 5 MB" },
  image_empty: { ar: "الصورة فاضية", en: "Image is empty" },
  image_type: {
    ar: "نوع الصورة لازم يكون jpeg أو png أو webp أو gif",
    en: "Image must be jpeg, png, webp, or gif",
  },

  voice_duration: { ar: "المدة", en: "Length" },
  voice_start: { ar: "تسجيل", en: "Record" },
  voice_stop_save: { ar: "إيقاف وحفظ", en: "Stop and save" },
  voice_stop: { ar: "إيقاف التسجيل", en: "Stop recording" },
  voice_play: { ar: "تشغيل التسجيل", en: "Play recording" },
  voice_pause: { ar: "إيقاف", en: "Pause" },
  voice_play_short: { ar: "تشغيل", en: "Play" },
  voice_mic_denied: { ar: "المتصفح منع الميكروفون", en: "Browser blocked the microphone" },
  voice_unsupported: { ar: "المتصفح مش بيدعم التسجيل", en: "Browser cannot record audio" },
  voice_play_error: { ar: "مش قادرين نشغّل التسجيل", en: "Cannot play the recording" },
  open_note_duration: { ar: "فتح الملاحظة، المدة", en: "Open note, length" },

  timezone: { ar: "المنطقة الزمنية", en: "Time zone" },
  day_start: { ar: "ساعة بداية اليوم", en: "Day start hour" },
  day_start_hint: { ar: "0 يعني منتصف الليل.", en: "0 means midnight." },
  reminders: { ar: "التذكيرات", en: "Reminders" },
  reminders_hint: {
    ar: "هيوصلك عدد الملاحظات المفتوحة بس.",
    en: "You only get the count of open notes.",
  },
  reminders_on: { ar: "تشغيل التذكير", en: "Turn on reminders" },
  add_time: { ar: "إضافة وقت", en: "Add time" },
  time_n: { ar: "الوقت", en: "Time" },
  remove_time: { ar: "إزالة الوقت", en: "Remove time" },
  allow_notifications: { ar: "السماح بالإشعارات", en: "Allow notifications" },
  enabling_notifications: { ar: "بنفعّل الإشعارات...", en: "Turning on notifications..." },
  notifications_allowed: { ar: "الإشعارات مسموحة.", en: "Notifications are allowed." },
  notifications_unsupported: {
    ar: "المتصفح ده مش بيدعم الإشعارات",
    en: "This browser does not support notifications",
  },
  notifications_denied: { ar: "المتصفح رفض الإشعارات", en: "Browser blocked notifications" },
  notifications_push_fail: {
    ar: "المتصفح مش قادر يوصل لخدمة الإشعارات.",
    en: "Browser cannot reach the push service.",
  },
  notifications_save_fail: { ar: "مش قادرين نسجل الإشعارات", en: "Cannot save notifications" },
  notifications_enable_fail: {
    ar: "مش قادرين نفعّل الإشعارات",
    en: "Cannot turn on notifications",
  },
  push_key_missing: { ar: "مفتاح الإشعار ناقص", en: "Push key is missing" },
  brave_push_hint: {
    ar: "Brave بيقفل إشعارات المواقع. افتح brave://settings/privacy وشغّل Use Google services for push messaging، وبعدين اقفل المتصفح وافتحه واضغط الزر تاني.",
    en: "Brave blocks site push. Open brave://settings/privacy, turn on Use Google services for push messaging, restart the browser, then press the button again.",
  },

  color_red: { ar: "أحمر", en: "Red" },
  color_orange: { ar: "برتقالي", en: "Orange" },
  color_amber: { ar: "ذهبي", en: "Gold" },
  color_green: { ar: "أخضر", en: "Green" },
  color_teal: { ar: "تركوازي", en: "Teal" },
  color_blue: { ar: "أزرق", en: "Blue" },
  color_violet: { ar: "بنفسجي", en: "Purple" },
  color_pink: { ar: "وردي", en: "Pink" },
} as const;

export type UiKey = keyof typeof UI;

export function tUi(locale: Locale, key: UiKey): string {
  return UI[key][locale] ?? UI[key][DEFAULT_LOCALE];
}
