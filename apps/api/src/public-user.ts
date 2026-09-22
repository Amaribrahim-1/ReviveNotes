import type { PublicUser } from "@revivenotes/shared";

export const publicUserSelect = {
  id: true,
  email: true,
  timezone: true,
  day_start_time: true,
  reminders_enabled: true,
  reminder_times: true,
} as const;

export function toPublicUser(user: PublicUser): PublicUser {
  return {
    id: user.id,
    email: user.email,
    timezone: user.timezone,
    day_start_time: user.day_start_time,
    reminders_enabled: user.reminders_enabled,
    reminder_times: user.reminder_times,
  };
}
