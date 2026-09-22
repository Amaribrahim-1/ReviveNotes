type LocalClock = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type UserDayRange = {
  start: Date;
  end: Date;
  localDate: string;
};

// Cairo with dayStartHour 14 runs 14:00–14:00. 13:00 local belongs to the previous calendar date.
export function getUserDayRange(timezone: string, dayStartHour: number, instant: Date): UserDayRange {
  const local = readLocalClock(instant, timezone);
  let year = local.year;
  let month = local.month;
  let day = local.day;

  if (local.hour < dayStartHour) {
    const previous = shiftCalendarDate(year, month, day, -1);
    year = previous.year;
    month = previous.month;
    day = previous.day;
  }

  const localDate = formatLocalDate(year, month, day);
  const start = utcInstantFromLocalClock(year, month, day, dayStartHour, timezone);
  const next = shiftCalendarDate(year, month, day, 1);
  const end = utcInstantFromLocalClock(next.year, next.month, next.day, dayStartHour, timezone);

  return { start, end, localDate };
}

function readLocalClock(instant: Date, timeZone: string): LocalClock {
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

  let hour = readPart(parts, "hour");
  // A few engines report midnight as 24. The calendar date from Intl is already the new day.
  if (hour === 24) {
    hour = 0;
  }

  return {
    year: readPart(parts, "year"),
    month: readPart(parts, "month"),
    day: readPart(parts, "day"),
    hour,
    minute: readPart(parts, "minute"),
    second: readPart(parts, "second"),
  };
}

function readPart(parts: Map<string, string>, name: string): number {
  const value = parts.get(name);
  if (value === undefined) {
    throw new Error(`missing ${name} from timezone parts`);
  }
  return Number(value);
}

function shiftCalendarDate(
  year: number,
  month: number,
  day: number,
  days: number,
): { year: number; month: number; day: number } {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function formatLocalDate(year: number, month: number, day: number): string {
  const monthText = String(month).padStart(2, "0");
  const dayText = String(day).padStart(2, "0");
  return `${year}-${monthText}-${dayText}`;
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const local = readLocalClock(instant, timeZone);
  const localAsUtc = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
  return localAsUtc - instant.getTime();
}

function utcInstantFromLocalClock(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
): Date {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, 0, 0);
  let utc = wallClockAsUtc;

  // The first offset can be wrong when daylight saving changes. Ask Intl again.
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const next = wallClockAsUtc - zoneOffsetMs(new Date(utc), timeZone);
    if (next === utc) {
      return new Date(utc);
    }
    utc = next;
  }

  return new Date(utc);
}
