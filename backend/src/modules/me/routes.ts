import { Router } from "express";
import { z } from "zod";
import { NOTIFICATION_TYPES } from "../../config/constants.js";
import { permissionsFor } from "../../config/permissions.js";
import { actorOf } from "../../middleware/auth.js";
import { audit } from "../../services/audit.service.js";
import { sendOk } from "../../utils/http.js";
import { httpUrl, phone, text } from "../../validators/common.js";
import { getCompanySettings } from "../settings/service.js";
import { User } from "../users/model.js";

const FIELDS =
  "name email phone image role status designation skills mutedNotifications joiningDate";

const updateProfileSchema = z
  .object({
    name: text(200).min(1),
    phone,
    image: httpUrl,
    mutedNotifications: z.array(z.enum(NOTIFICATION_TYPES)),
  })
  .partial();

export const meRoutes = Router();

// Role and status are not in the schema, so a user cannot grant themselves anything here.
meRoutes.get("/", async (req, res) => {
  const actor = actorOf(req);
  const [user, settings] = await Promise.all([
    User.findById(actor.id).select(FIELDS).lean(),
    getCompanySettings(),
  ]);
  sendOk(res, {
    user,
    permissions: permissionsFor(actor.role),
    preferences: settings.preferences,
    companyName: settings.company?.name,
  });
});

meRoutes.patch("/", async (req, res) => {
  const actor = actorOf(req);
  const user = await User.findByIdAndUpdate(
    actor.id,
    { $set: updateProfileSchema.parse(req.body) },
    { returnDocument: "after", runValidators: true },
  )
    .select(FIELDS)
    .lean();
  await audit(actor, { action: "profile.update", entityType: "User", entityId: actor.id });
  sendOk(res, user, { message: "Profile updated" });
});
