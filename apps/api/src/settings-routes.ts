import { updateSettingsSchema, type UpdateSettingsInput } from "@revivenotes/shared";
import type { Request, Response } from "express";
import { prisma } from "./db.js";
import { publicUserSelect, toPublicUser } from "./public-user.js";
import { readSignedInUser } from "./require-user.js";

function firstIssueMessage(issues: { message: string }[]): string {
  return issues[0]?.message ?? "البيانات مش مظبوطة";
}

export async function updateSettings(req: Request, res: Response) {
  const parsed = updateSettingsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssueMessage(parsed.error.issues) });
    return;
  }

  const user = readSignedInUser(res);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      timezone: parsed.data.timezone,
      day_start_time: parsed.data.day_start_time,
      ...reminderColumns(parsed.data),
    },
    select: publicUserSelect,
  });

  res.json(toPublicUser(updated));
}

// Disabled reminders keep the old times and ignore whatever times arrived in this request.
function reminderColumns(input: UpdateSettingsInput): {
  reminders_enabled?: boolean;
  reminder_times?: string[];
} {
  if (input.reminders_enabled === true) {
    return {
      reminders_enabled: true,
      reminder_times: input.reminder_times ?? [],
    };
  }
  if (input.reminders_enabled === false) {
    return { reminders_enabled: false };
  }
  return {};
}
