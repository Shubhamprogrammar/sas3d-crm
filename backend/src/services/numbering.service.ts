import type { ClientSession } from "mongoose";
import { CompanySettings, Counter } from "../modules/settings/model.js";

async function next(counterId: string, session?: ClientSession) {
  const counter = await Counter.findOneAndUpdate(
    { _id: counterId },
    { $inc: { value: 1 } },
    { upsert: true, returnDocument: "after", session },
  );
  return counter.value;
}

export const formatNumber = (
  config: { prefix: string; padding: number; includeYear: boolean },
  sequence: number,
  year: number,
) =>
  [
    config.prefix,
    config.includeYear ? String(year) : null,
    String(sequence).padStart(config.padding, "0"),
  ]
    .filter(Boolean)
    .join("-");

export async function nextDocumentNumber(kind: "proposal" | "invoice", session?: ClientSession) {
  const settings = await CompanySettings.findOne({ key: "default" })
    .session(session ?? null)
    .lean();
  const config = {
    prefix: settings?.documents?.[kind]?.prefix ?? (kind === "invoice" ? "INV" : "PROP"),
    padding: settings?.documents?.[kind]?.padding ?? 4,
    includeYear: settings?.documents?.[kind]?.includeYear ?? true,
  };
  const year = new Date().getUTCFullYear();
  const scope = config.includeYear ? `${kind}-${year}` : kind;
  return formatNumber(config, await next(scope, session), year);
}

export async function nextProjectCode(session?: ClientSession) {
  const year = new Date().getUTCFullYear();
  return `PRJ-${year}-${String(await next(`project-${year}`, session)).padStart(4, "0")}`;
}
