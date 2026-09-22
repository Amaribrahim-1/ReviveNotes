import { describe, expect, it } from "vitest";
import { getUserDayRange, type UserDayRange } from "./user-day.js";

type LocalClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function localClock(instant: Date, timeZone: string): LocalClock {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = new Map<string, string>();
  for (const part of formatter.formatToParts(instant)) {
    if (part.type !== "literal") {
      parts.set(part.type, part.value);
    }
  }

  let hour = Number(parts.get("hour"));
  if (hour === 24) {
    hour = 0;
  }

  return {
    year: Number(parts.get("year")),
    month: Number(parts.get("month")),
    day: Number(parts.get("day")),
    hour,
    minute: Number(parts.get("minute")),
    second: Number(parts.get("second")),
  };
}

function formatLocalDate(clock: LocalClock): string {
  const month = String(clock.month).padStart(2, "0");
  const day = String(clock.day).padStart(2, "0");
  return `${clock.year}-${month}-${day}`;
}

function previousCalendarDate(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const utc = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
  utc.setUTCDate(utc.getUTCDate() - 1);
  const nextMonth = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(utc.getUTCDate()).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${nextMonth}-${nextDay}`;
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const clock = localClock(instant, timeZone);
  const localAsUtc = Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute, clock.second);
  return localAsUtc - instant.getTime();
}

// Walk UTC minutes until Intl says this wall-clock time. The offset is not written down.
function instantAtLocal(timeZone: string, year: number, month: number, day: number, hour: number, minute: number): Date {
  const searchStart = Date.UTC(year, month - 1, day, hour, minute) - 16 * 60 * 60 * 1000;
  const searchEnd = searchStart + 32 * 60 * 60 * 1000;

  for (let utc = searchStart; utc <= searchEnd; utc += 60 * 1000) {
    const clock = localClock(new Date(utc), timeZone);
    if (
      clock.year === year &&
      clock.month === month &&
      clock.day === day &&
      clock.hour === hour &&
      clock.minute === minute &&
      clock.second === 0
    ) {
      return new Date(utc);
    }
  }

  throw new Error(`no instant for ${timeZone} ${year}-${month}-${day} ${hour}:${minute}`);
}

function expectInsideDay(range: UserDayRange, instant: Date) {
  expect(instant.getTime()).toBeGreaterThanOrEqual(range.start.getTime());
  expect(instant.getTime()).toBeLessThan(range.end.getTime());
}

function expectWallClock(instant: Date, timeZone: string, year: number, month: number, day: number, hour: number) {
  const clock = localClock(instant, timeZone);
  expect(clock.year).toBe(year);
  expect(clock.month).toBe(month);
  expect(clock.day).toBe(day);
  expect(clock.hour).toBe(hour);
  expect(clock.minute).toBe(0);
}

describe("getUserDayRange", () => {
  it("puts 13:00 in Cairo on the previous calendar date and 14:00 on that date", () => {
    const at13 = instantAtLocal("Africa/Cairo", 2026, 6, 15, 13, 0);
    const at14 = instantAtLocal("Africa/Cairo", 2026, 6, 15, 14, 0);
    expect(localClock(at13, "Africa/Cairo").hour).toBe(13);
    expect(localClock(at14, "Africa/Cairo").hour).toBe(14);

    const beforeStart = at13.getTime();
    const early = getUserDayRange("Africa/Cairo", 14, at13);
    const onTime = getUserDayRange("Africa/Cairo", 14, at14);

    expect(at13.getTime()).toBe(beforeStart);
    expect(early.localDate).toBe("2026-06-14");
    expect(onTime.localDate).toBe("2026-06-15");
    expect(early.localDate).toBe(previousCalendarDate(onTime.localDate));

    expectInsideDay(early, at13);
    expectInsideDay(onTime, at14);
    expectWallClock(early.start, "Africa/Cairo", 2026, 6, 14, 14);
    expectWallClock(early.end, "Africa/Cairo", 2026, 6, 15, 14);
    expectWallClock(onTime.start, "Africa/Cairo", 2026, 6, 15, 14);
    expectWallClock(onTime.end, "Africa/Cairo", 2026, 6, 16, 14);
  });

  it("splits the calendar date around the local start hour when the zone observes daylight saving", () => {
    const winterNoon = instantAtLocal("America/New_York", 2026, 1, 15, 12, 0);
    const summerNoon = instantAtLocal("America/New_York", 2026, 7, 15, 12, 0);
    expect(zoneOffsetMs(winterNoon, "America/New_York")).not.toBe(zoneOffsetMs(summerNoon, "America/New_York"));

    const justBefore = instantAtLocal("America/New_York", 2026, 7, 15, 8, 59);
    const justAfter = instantAtLocal("America/New_York", 2026, 7, 15, 9, 0);
    const beforeClock = localClock(justBefore, "America/New_York");
    const afterClock = localClock(justAfter, "America/New_York");
    expect(beforeClock.hour).toBe(8);
    expect(afterClock.hour).toBe(9);

    const beforeDay = getUserDayRange("America/New_York", 9, justBefore);
    const afterDay = getUserDayRange("America/New_York", 9, justAfter);

    expect(afterDay.localDate).toBe(formatLocalDate(afterClock));
    expect(beforeDay.localDate).toBe(previousCalendarDate(afterDay.localDate));
    expectInsideDay(beforeDay, justBefore);
    expectInsideDay(afterDay, justAfter);
  });
});
