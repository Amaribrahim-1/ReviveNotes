import { z } from "zod";

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

export const updateSettingsSchema = z
  .object({
    timezone: z
      .string({ error: "timezone_pick" })
      .trim()
      .min(1, { error: "timezone_pick" })
      .refine(isIanaTimeZone, { error: "timezone_invalid" }),
    day_start_time: z
      .number({ error: "hour_invalid" })
      .int({ error: "hour_invalid" })
      .min(0, { error: "hour_invalid" })
      .max(23, { error: "hour_invalid" }),
    reminders_enabled: z.boolean().optional(),
    reminder_times: z.array(z.string()).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.reminders_enabled !== true) {
      return;
    }
    if (!reminderTimesAreValid(value.reminder_times)) {
      ctx.addIssue("reminder_times_invalid");
    }
  });

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
