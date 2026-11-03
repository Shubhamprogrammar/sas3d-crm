import { z } from "zod";
import { CURRENCIES } from "../config/constants.js";
import { objectId, optionalObjectId } from "../utils/query.js";

/*
 * Create schemas here intentionally carry no `.default()`: Zod applies defaults inside `.partial()`
 * too, which would overwrite stored values on PATCH. Defaults live on the Mongoose schemas.
 */
export const text = (max = 500) => z.string().trim().max(max);
export const longText = text(20000);

const emptyToNull = (value: unknown) => (value === "" ? null : value);

export const nullableDate = z.preprocess(emptyToNull, z.coerce.date().nullable());
export const email = z.union([z.literal(""), z.string().trim().toLowerCase().pipe(z.email())]);
export const phone = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()\-.]{5,25}$/, "Use international format, e.g. +1 415 555 0100"),
]);
/** Only http(s) URLs: these render as links, so `javascript:` must never be stored. */
export const httpUrl = z.union([
  z.literal(""),
  z
    .string()
    .trim()
    .max(2000)
    .pipe(z.url({ protocol: /^https?$/ })),
]);
export const timezone = z.union([
  z.literal(""),
  z.string().refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone"),
]);
export const currency = z.enum(CURRENCIES);
export const minorUnits = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
export const stringList = z.array(text(100)).max(100);
export const dateRange = {
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
};

export const lineItem = z.object({
  service: optionalObjectId,
  description: text(1000).min(1, "Description is required"),
  quantity: z.number().min(0.001).max(1_000_000),
  unitPrice: minorUnits,
});
export const discount = z
  .object({
    type: z.enum(["PERCENT", "FIXED"]),
    value: minorUnits,
  })
  .refine(
    (d) => d.type !== "PERCENT" || d.value <= 10000,
    "A percentage discount cannot exceed 100%",
  );
export const taxRateBp = z.number().int().min(0).max(10000);

export const totalsPreview = z.object({
  items: z.array(lineItem.pick({ quantity: true, unitPrice: true })).max(200),
  discount: discount.optional(),
  taxRateBp: taxRateBp.optional(),
});

export { objectId, optionalObjectId };
