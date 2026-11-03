import { z } from "zod";
import { PRICING_MODELS, SERVICE_CATEGORIES } from "../../config/constants.js";
import { currency, longText, minorUnits, stringList, text } from "../../validators/common.js";
import { paginationQuery } from "../../utils/query.js";

const fields = z.object({
  name: text(200).min(1, "Service name is required"),
  description: longText.optional(),
  category: z.enum(SERVICE_CATEGORIES),
  startingPrice: minorUnits.optional(),
  currency: currency.optional(),
  pricingModel: z.enum(PRICING_MODELS).optional(),
  estimatedDelivery: text(200).optional(),
  technologies: stringList.optional(),
  isActive: z.boolean().optional(),
});
export const createServiceSchema = fields;
export const updateServiceSchema = fields.partial();
export const listServicesSchema = paginationQuery.extend({
  category: z.enum(SERVICE_CATEGORIES).optional(),
  active: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(20),
});
