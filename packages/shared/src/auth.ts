import { z } from "zod";

const emailField = z
  .string({ error: "اكتب البريد" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "البريد مش صحيح" }));

const passwordField = z
  .string({ error: "اكتب كلمة السر" })
  .min(8, { error: "كلمة السر لازم تكون 8 حروف على الأقل" })
  .refine((value) => new TextEncoder().encode(value).length <= 72, {
    error: "كلمة السر أطول من المسموح",
  });

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  timezone: z
    .string({ error: "المنطقة الزمنية ناقصة" })
    .trim()
    .min(1, { error: "المنطقة الزمنية ناقصة" }),
});

export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export type PublicUser = {
  id: string;
  email: string;
  timezone: string;
  day_start_time: number;
  reminders_enabled: boolean;
  reminder_times: string[];
};
