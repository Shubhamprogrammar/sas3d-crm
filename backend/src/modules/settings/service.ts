import { audit } from "../../services/audit.service.js";
import type { Actor } from "../../types/express.js";
import { CompanySettings } from "./model.js";

export async function getCompanySettings() {
  const settings = await CompanySettings.findOneAndUpdate(
    { key: "default" },
    { $setOnInsert: { key: "default" } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  ).lean();
  return settings;
}

export type CompanySettingsData = Awaited<ReturnType<typeof getCompanySettings>>;

export const getCompanyTimezone = async () =>
  (await getCompanySettings()).preferences?.timezone ?? "Asia/Kolkata";

const flatten = (value: Record<string, unknown>, prefix = ""): Record<string, unknown> =>
  Object.entries(value).reduce<Record<string, unknown>>((flat, [key, nested]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (nested !== null && typeof nested === "object" && !Array.isArray(nested)) {
      Object.assign(flat, flatten(nested as Record<string, unknown>, path));
    } else {
      flat[path] = nested;
    }
    return flat;
  }, {});

export async function updateCompanySettings(actor: Actor, input: Record<string, unknown>) {
  await getCompanySettings();
  const settings = await CompanySettings.findOneAndUpdate(
    { key: "default" },
    { $set: { ...flatten(input), updatedBy: actor.id } },
    { returnDocument: "after", runValidators: true },
  ).lean();
  await audit(actor, {
    action: "settings.update",
    entityType: "CompanySettings",
    summary: Object.keys(input).join(", "),
  });
  return settings;
}
