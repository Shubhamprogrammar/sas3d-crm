import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { toObjectId } from "../../database/connection.js";
import { actorOf } from "../../middleware/auth.js";
import { assertFound } from "../../services/scope.service.js";
import { sendOk } from "../../utils/http.js";
import { idParam, paginate, paginationQuery } from "../../utils/query.js";
import { Notification } from "./model.js";

const listSchema = paginationQuery.extend({ unread: z.enum(["true", "false"]).optional() });

// Every query is keyed by recipient, so one user can never read or change another's notifications.
export const notificationRoutes = Router();

notificationRoutes.get("/", async (req: Request, res: Response) => {
  const query = listSchema.parse(req.query);
  const recipient = toObjectId(actorOf(req).id);
  const { items, meta } = await paginate(
    Notification,
    { recipient, ...(query.unread === "true" ? { readAt: null } : {}) },
    { page: query.page, limit: query.limit },
  );
  sendOk(res, items, { meta });
});

notificationRoutes.get("/unread-count", async (req: Request, res: Response) => {
  const count = await Notification.countDocuments({ recipient: actorOf(req).id, readAt: null });
  sendOk(res, { count });
});

notificationRoutes.post("/read-all", async (req: Request, res: Response) => {
  await Notification.updateMany(
    { recipient: actorOf(req).id, readAt: null },
    { $set: { readAt: new Date() } },
  );
  sendOk(res, null, { message: "All notifications marked as read" });
});

notificationRoutes.post("/:id/read", async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const notification = await Notification.findOneAndUpdate(
    { _id: id, recipient: actorOf(req).id },
    { $set: { readAt: new Date() } },
    { returnDocument: "after" },
  );
  sendOk(res, assertFound(notification, "Notification"));
});
