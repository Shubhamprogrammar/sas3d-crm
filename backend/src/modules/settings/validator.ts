import { z } from "zod";
import {
  email,
  httpUrl,
  phone,
  currency,
  longText,
  text,
  timezone,
} from "../../validators/common.js";

const numbering = {
  prefix: text(12).regex(/^[A-Za-z0-9]*$/, "Use letters and numbers only"),
  padding: z.number().int().min(3).max(8),
  includeYear: z.boolean(),
};

// Logos are stored inline, so this bounds the settings document as well as the image.
const logo = z.union([
  z.literal(""),
  z
    .string()
    .max(700_000, "Logo must be under 500 KB")
    .regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "Logo must be a PNG or JPEG"),
]);

export const updateSettingsSchema = z
  .object({
    company: z
      .object({
        name: text(200),
        logoUrl: logo,
        website: httpUrl,
        email,
        phone,
        address: text(1000),
        taxInfo: text(1000),
      })
      .partial(),
    preferences: z
      .object({
        defaultCurrency: currency,
        timezone,
        dateFormat: z.enum(["DD MMM YYYY", "MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"]),
        timeFormat: z.enum(["12h", "24h"]),
        theme: z.enum(["light", "dark", "system"]),
      })
      .partial(),
    documents: z
      .object({
        proposal: z
          .object({
            ...numbering,
            introduction: longText,
            defaultTerms: longText,
            footer: text(500),
          })
          .partial(),
        invoice: z
          .object({
            ...numbering,
            defaultPaymentTerms: longText,
            bankDetails: longText,
            footer: text(500),
          })
          .partial(),
      })
      .partial(),
  })
  .partial();
