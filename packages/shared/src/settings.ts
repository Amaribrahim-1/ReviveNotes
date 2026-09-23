import { z } from "zod";

const hourMessage = "اختار ساعة من 0 لـ 23";
const reminderTimesMessage = "اختار من 1 لـ 3 أوقات مختلفة";
const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

function reminderTimesAreValid(times: string[] | undefined): boolean {
  if (!times || times.length < 1 || times.length > 3) {
    return false;
  }
  if (new Set(times).size !== times.length) {
    return false;
  }
  return times.every((time) => hhmm.test(time));
}

function isIanaTimeZone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export const updateSettingsSchema = z.object({
  timezone: z
    .string({ error: "اختار المنطقة الزمنية" })
    .trim()
    .min(1, { error: "اختار المنطقة الزمنية" })
    .refine(isIanaTimeZone, { error: "المنطقة الزمنية مش صحيحة" }),
  day_start_time: z
    .number({ error: hourMessage })
    .int({ error: hourMessage })
    .min(0, { error: hourMessage })
    .max(23, { error: hourMessage }),
  reminders_enabled: z.boolean().optional(),
  reminder_times: z.array(z.string()).optional(),
}).superRefine((value, ctx) => {
  if (value.reminders_enabled !== true) {
    return;
  }
  if (!reminderTimesAreValid(value.reminder_times)) {
    ctx.addIssue(reminderTimesMessage);
  }
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
