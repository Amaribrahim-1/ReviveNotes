import { z } from "zod";

const emailField = z
  .string({ error: "email_required" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "email_invalid" }));

const passwordField = z
  .string({ error: "password_required" })
  .min(8, { error: "password_min" })
  .refine((value) => new TextEncoder().encode(value).length <= 72, {
    error: "password_too_long",
  });

export const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  timezone: z
    .string({ error: "timezone_required" })
    .trim()
    .min(1, { error: "timezone_required" }),
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
