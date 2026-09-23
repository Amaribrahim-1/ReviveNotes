import type { TodayProgress } from "@revivenotes/shared";
import type { Request, Response } from "express";
import { prisma } from "./db.js";
import { readSignedInUser } from "./require-user.js";
import { getUserDayRange } from "./user-day.js";

export async function getTodayProgress(_req: Request, res: Response) {
  const user = readSignedInUser(res);
  const now = new Date();
  // Same window as the inbox day. start is included. end is the next day-start, so it is not.
  // archived writes no ClearEvent, so those items never appear in this count.
  const day = getUserDayRange(user.timezone, user.day_start_time, now);

  const cleared = await prisma.clearEvent.count({
    where: {
      user_id: user.id,
      kind: { in: ["done", "deleted"] },
      created_at: {
        gte: day.start,
        lt: day.end,
      },
    },
  });

  const body: TodayProgress = { cleared };
  res.json(body);
}
