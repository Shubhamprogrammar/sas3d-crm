import { z } from "zod";
import { CURRENCIES } from "@/lib/constants";
import { isValidAmount } from "@/utils/money";
import { isPriceValid, isQuantityValid } from "./line-items-editor";

/** Validation shared by the proposal and invoice editors. */
export const pricingFields = {
  currency: z.enum(CURRENCIES),
  items: z
    .array(
      z.object({
        service: z.string(),
        description: z.string().trim().min(1, "Required"),
        quantity: z.string().refine(isQuantityValid, "Up to 3 decimals"),
        unitPrice: z.string().refine(isPriceValid, "Enter a price"),
      }),
    )
    .min(1),
  discountType: z.enum(["PERCENT", "FIXED"]),
  discountValue: z.string().refine(isValidAmount, "Enter a number"),
  taxRate: z.string().refine(isValidAmount, "Enter a number"),
  taxLabel: z.string(),
};
