/**
 * Display-side conversion between decimal text and integer minor units. It works on the digits as
 * strings so a typed "19.99" never passes through a float. All totals are computed by the server.
 */
export function toMinor(value: string | number | null | undefined): number {
  const text = String(value ?? "")
    .trim()
    .replaceAll(",", "");
  if (!text) return 0;
  const match = /^(\d+)(?:\.(\d{0,2}))?$/.exec(text);
  if (!match) throw new Error("Enter an amount like 1234.56");
  const whole = match[1] as string;
  const fraction = (match[2] ?? "").padEnd(2, "0");
  return Number(BigInt(whole) * 100n + BigInt(fraction));
}

export const isValidAmount = (value: string) => /^\s*[\d,]*(\.\d{0,2})?\s*$/.test(value);

export function fromMinor(value: number | null | undefined): string {
  const amount = BigInt(Math.abs(value ?? 0));
  return `${amount / 100n}.${(amount % 100n).toString().padStart(2, "0")}`;
}

export function formatMoney(value: number | null | undefined, currency: string) {
  const amount = value ?? 0;
  const abs = BigInt(Math.abs(amount));
  const major = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const minor = (abs % 100n).toString().padStart(2, "0");
  return `${amount < 0 ? "-" : ""}${currency} ${major}.${minor}`;
}

/** Percent text to basis points, e.g. "12.5" to 1250. */
export function percentToBp(value: string | number | null | undefined): number {
  return toMinor(value);
}
export const bpToPercent = (bp: number | null | undefined) => fromMinor(bp).replace(/\.00$/, "");
