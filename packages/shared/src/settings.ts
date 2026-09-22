import { z } from "zod";

const hourMessage = "اختار ساعة من 0 لـ 23";

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
});

export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
