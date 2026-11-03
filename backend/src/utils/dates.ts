/** Offset in ms between a time zone's wall clock and UTC at the given instant. */
function zoneOffset(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

function wallClock(date: Date, timeZone: string) {
  return new Date(date.getTime() + zoneOffset(date, timeZone));
}

/** Converts a wall-clock date in `timeZone` to the UTC instant. Re-checks once to handle DST edges. */
function fromWallClock(year: number, month: number, day: number, timeZone: string) {
  const guess = new Date(Date.UTC(year, month, day));
  const first = new Date(guess.getTime() - zoneOffset(guess, timeZone));
  return new Date(guess.getTime() - zoneOffset(first, timeZone));
}

export function startOfDayInZone(date: Date, timeZone: string) {
  const local = wallClock(date, timeZone);
  return fromWallClock(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), timeZone);
}

export const RANGE_PRESETS = [
  "today",
  "last_7_days",
  "last_30_days",
  "this_month",
  "last_month",
  "this_year",
  "custom",
] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** Resolves a dashboard or report period to UTC instants, with `to` exclusive. */
export function resolveRange(
  preset: RangePreset,
  timeZone: string,
  custom: { from?: Date; to?: Date } = {},
  now = new Date(),
) {
  const DAY = 24 * 60 * 60 * 1000;
  const today = startOfDayInZone(now, timeZone);
  const tomorrow = startOfDayInZone(new Date(today.getTime() + DAY + 2 * 60 * 60 * 1000), timeZone);
  const local = wallClock(now, timeZone);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();

  switch (preset) {
    case "today":
      return { from: today, to: tomorrow };
    case "last_7_days":
      return { from: new Date(today.getTime() - 6 * DAY), to: tomorrow };
    case "last_30_days":
      return { from: new Date(today.getTime() - 29 * DAY), to: tomorrow };
    case "last_month":
      return {
        from: fromWallClock(year, month - 1, 1, timeZone),
        to: fromWallClock(year, month, 1, timeZone),
      };
    case "this_year":
      return {
        from: fromWallClock(year, 0, 1, timeZone),
        to: fromWallClock(year + 1, 0, 1, timeZone),
      };
    case "custom":
      return {
        from: custom.from ?? new Date(0),
        to: custom.to
          ? new Date(custom.to.getTime() + (isMidnightUtc(custom.to) ? DAY : 0))
          : tomorrow,
      };
    case "this_month":
    default:
      return {
        from: fromWallClock(year, month, 1, timeZone),
        to: fromWallClock(year, month + 1, 1, timeZone),
      };
  }
}

/** A date-only "to" arrives as midnight UTC and should include that whole day. */
const isMidnightUtc = (date: Date) => date.getTime() % (24 * 60 * 60 * 1000) === 0;

/** Overdue begins the day after the due date in the company's time zone. */
export const isPastDue = (dueDate: Date, timeZone: string, now = new Date()) => {
  const due = wallClock(dueDate, "UTC");
  const endOfDueDate = fromWallClock(
    due.getUTCFullYear(),
    due.getUTCMonth(),
    due.getUTCDate() + 1,
    timeZone,
  );
  return now >= endOfDueDate;
};
