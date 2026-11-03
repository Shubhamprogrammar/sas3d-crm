/**
 * Decimal-safe monetary calculations. Amounts are integer minor units (paise, cents, fils).
 * All supported currencies have exactly 2 decimal places, so 1 major unit = 100 minor units.
 * Quantities are held in thousandths and rates in basis points, and every product goes
 * through BigInt with half-up rounding, so no floating-point value ever reaches a total.
 */
export const QUANTITY_SCALE = 1000n;
export const BASIS_POINTS = 10_000n;

export interface LineInput {
  quantity: number;
  unitPrice: number;
}
export interface DiscountInput {
  type: "PERCENT" | "FIXED";
  /** Basis points for PERCENT (1250 = 12.5%), minor units for FIXED. */
  value: number;
}
export interface Totals {
  lineAmounts: number[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

const divideHalfUp = (numerator: bigint, denominator: bigint) =>
  (numerator + denominator / 2n) / denominator;

const toSafeNumber = (value: bigint) => {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("Monetary amount is too large");
  return Number(value);
};

/** Converts a decimal quantity of at most 3 places to integer thousandths. */
export const quantityToThousandths = (quantity: number) => {
  const thousandths = Math.round(quantity * 1000);
  if (Math.abs(quantity * 1000 - thousandths) > 1e-6) {
    throw new RangeError("Quantity supports at most 3 decimal places");
  }
  return BigInt(thousandths);
};

export const lineAmount = ({ quantity, unitPrice }: LineInput) =>
  toSafeNumber(divideHalfUp(quantityToThousandths(quantity) * BigInt(unitPrice), QUANTITY_SCALE));

export function calculateTotals(
  lines: LineInput[],
  discount: DiscountInput | undefined,
  taxRateBp: number,
): Totals {
  const lineAmounts = lines.map(lineAmount);
  const subtotal = lineAmounts.reduce((sum, amount) => sum + BigInt(amount), 0n);

  let discountAmount = 0n;
  if (discount && discount.value > 0) {
    discountAmount =
      discount.type === "PERCENT"
        ? divideHalfUp(subtotal * BigInt(discount.value), BASIS_POINTS)
        : BigInt(discount.value);
  }
  if (discountAmount > subtotal) throw new RangeError("Discount cannot exceed the subtotal");

  const taxable = subtotal - discountAmount;
  const taxAmount = divideHalfUp(taxable * BigInt(taxRateBp), BASIS_POINTS);

  return {
    lineAmounts,
    subtotal: toSafeNumber(subtotal),
    discountAmount: toSafeNumber(discountAmount),
    taxAmount: toSafeNumber(taxAmount),
    total: toSafeNumber(taxable + taxAmount),
  };
}

/** Formats minor units for documents and exports without passing through a float. */
export function formatMinor(amount: number, currency: string): string {
  const negative = amount < 0;
  const abs = BigInt(Math.abs(amount));
  const major = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const minor = (abs % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${currency} ${major}.${minor}`;
}

/** Plain decimal text for CSV exports, e.g. 123456 becomes "1234.56". */
export function minorToDecimal(amount: number): string {
  const abs = BigInt(Math.abs(amount));
  return `${amount < 0 ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}
