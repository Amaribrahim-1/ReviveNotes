import { timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { prisma } from "./db.js";
import { sendWebPush } from "./push-sender.js";
import { msg } from "./request-locale.js";
import { readLocalCalendar } from "./user-day.js";

type StoredSubscription = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function dispatchReminders(req: Request, res: Response) {
  if (!cronSecretMatches(req.header("x-cron-secret"))) {
    res.status(401).json({ error: msg(req, "cron_secret_invalid") });
    return;
  }

  await runReminderDispatch(new Date());
  res.type("text/plain").send("OK");
}

export async function runReminderDispatch(now: Date) {
  const users = await prisma.user.findMany({
    where: { reminders_enabled: true },
    orderBy: { id: "asc" },
    select: {
      id: true,
      timezone: true,
      reminder_times: true,
      push_subscriptions: {
        select: { id: true, endpoint: true, p256dh: true, auth: true },
      },
    },
  });

  for (const user of users) {
    try {
      await dispatchUser(user, now);
    } catch (error) {
      console.error(error);
    }
  }
}

async function dispatchUser(
  user: {
    id: string;
    timezone: string;
    reminder_times: string[];
    push_subscriptions: StoredSubscription[];
  },
  now: Date,
) {
  const calendar = readLocalCalendar(now, user.timezone);
  const localDate = calendarDateForDb(calendar.localDate);

  for (const slot of user.reminder_times) {
    if (!slotIsDue(calendar.hour, calendar.minute, slot)) {
      continue;
    }

    const alreadySent = await prisma.reminderDelivery.findFirst({
      where: { user_id: user.id, local_date: localDate, slot },
      select: { id: true },
    });
    if (alreadySent) {
      continue;
    }

    const delivered = await deliverSlot(user.id, user.push_subscriptions);
    if (!delivered) {
      continue;
    }

    await prisma.reminderDelivery.create({
      data: {
        user_id: user.id,
        local_date: localDate,
        slot,
      },
    });
  }
}

// A delivery row is written only after a push is accepted. A throw, or no live subscription, leaves the slot open.
async function deliverSlot(userId: string, subscriptions: StoredSubscription[]): Promise<boolean> {
  const count = await prisma.item.count({
    where: {
      user_id: userId,
      status: { in: ["inbox", "active"] },
    },
  });
  const body = String(count);
  let sent = false;
  let threw = false;

  for (const subscription of subscriptions) {
    try {
      const result = await sendWebPush(subscription, body);
      if (result === "gone") {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } });
        continue;
      }
      sent = true;
    } catch (error) {
      console.error(error);
      threw = true;
    }
  }

  return sent && !threw;
}

function slotIsDue(hour: number, minute: number, slot: string): boolean {
  const parts = slot.split(":");
  if (parts.length !== 2) {
    return false;
  }
  const slotHour = Number(parts[0]);
  const slotMinute = Number(parts[1]);
  if (!Number.isInteger(slotHour) || !Number.isInteger(slotMinute)) {
    return false;
  }
  return hour * 60 + minute >= slotHour * 60 + slotMinute;
}

function calendarDateForDb(localDate: string): Date {
  const parts = localDate.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  return new Date(Date.UTC(year, month - 1, day));
}

function cronSecretMatches(header: string | undefined): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected || !header) {
    return false;
  }
  const provided = Buffer.from(header);
  const secret = Buffer.from(expected);
  if (provided.length !== secret.length) {
    return false;
  }
  return timingSafeEqual(provided, secret);
}
