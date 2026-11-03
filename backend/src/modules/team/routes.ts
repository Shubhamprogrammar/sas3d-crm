import { Router } from "express";
import { actorOf, requirePermission as can } from "../../middleware/auth.js";
import { sendOk } from "../../utils/http.js";
import { idParam } from "../../utils/query.js";
import * as service from "./service.js";
import {
  createMemberSchema,
  listTeamSchema,
  setStatusSchema,
  updateMemberSchema,
} from "./validator.js";

export const teamRoutes = Router();

teamRoutes.get("/", can("team:read"), async (req, res) => {
  const { items, meta } = await service.listTeam(listTeamSchema.parse(req.query));
  sendOk(res, items, { meta });
});
teamRoutes.post("/", can("team:write"), async (req, res) => {
  const member = await service.createMember(actorOf(req), createMemberSchema.parse(req.body));
  sendOk(res, member, { status: 201, message: "Team member created" });
});
teamRoutes.get("/:id", can("team:read"), async (req, res) => {
  sendOk(res, await service.getMember(idParam.parse(req.params).id));
});
teamRoutes.patch("/:id", can("team:write"), async (req, res) => {
  const member = await service.updateMember(
    actorOf(req),
    idParam.parse(req.params).id,
    updateMemberSchema.parse(req.body),
  );
  sendOk(res, member, { message: "Team member updated" });
});
teamRoutes.post("/:id/status", can("team:write"), async (req, res) => {
  const member = await service.setMemberStatus(
    actorOf(req),
    idParam.parse(req.params).id,
    setStatusSchema.parse(req.body).status,
  );
  sendOk(res, member, { message: "Status updated" });
});
