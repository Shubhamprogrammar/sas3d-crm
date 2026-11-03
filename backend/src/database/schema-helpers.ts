import { Schema } from "mongoose";

export const ref = <const E extends object>(model: string, extra?: E) => ({
  type: Schema.Types.ObjectId,
  ref: model,
  default: null,
  ...(extra as E),
});

/** Non-negative integer minor units (see utils/money.ts). */
export const money = <const E extends object>(extra: E) => ({
  type: Number,
  min: 0,
  validate: { validator: Number.isSafeInteger, message: "Amounts must be integer minor units" },
  ...extra,
});

export const lineItemSchema = new Schema(
  {
    service: ref("Service"),
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    quantity: { type: Number, required: true, min: 0.001 },
    unitPrice: money({ required: true }),
    amount: money({ required: true }),
  },
  { _id: false },
);

export const discountSchema = new Schema(
  {
    type: { type: String, enum: ["PERCENT", "FIXED"], default: "PERCENT" },
    value: money({ default: 0 }),
  },
  { _id: false },
);
