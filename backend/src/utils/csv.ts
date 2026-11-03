/**
 * Neutralises CSV formula injection: spreadsheet apps execute cells beginning with these characters.
 * Plain signed numbers and international phone numbers stay untouched.
 */
export function csvSafe(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/^[+-][\d\s().-]*$/.test(text)) return text;
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}
