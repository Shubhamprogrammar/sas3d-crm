import { Router } from "express";
import { z } from "zod";
import { hasPermission } from "../../config/permissions.js";
import { actorOf } from "../../middleware/auth.js";
import {
  clientScope,
  leadScope,
  projectScope,
  proposalScope,
  taskScope,
} from "../../services/scope.service.js";
import { sendOk } from "../../utils/http.js";
import { searchFilter } from "../../utils/query.js";
import { Client } from "../clients/model.js";
import { Invoice } from "../invoices/model.js";
import { Lead } from "../leads/model.js";
import { Project } from "../projects/model.js";
import { Proposal } from "../proposals/model.js";
import { Task } from "../tasks/model.js";

const LIMIT = 5;

export const searchRoutes = Router();

searchRoutes.get("/", async (req, res) => {
  const actor = actorOf(req);
  const { q } = z.object({ q: z.string().trim().min(2).max(100) }).parse(req.query);
  const can = (permission: Parameters<typeof hasPermission>[1]) =>
    hasPermission(actor.role, permission);

  const [leads, clients, projects, proposals, invoices, tasks] = await Promise.all([
    can("lead:read")
      ? Lead.find({
          $and: [
            leadScope(actor),
            { archivedAt: null },
            searchFilter(["fullName", "companyName", "email", "phone"], q),
          ],
        })
          .select("fullName companyName status")
          .limit(LIMIT)
          .lean()
      : [],
    can("client:read")
      ? Client.find({
          $and: [await clientScope(actor), searchFilter(["name", "companyName", "email"], q)],
        })
          .select("name companyName status")
          .limit(LIMIT)
          .lean()
      : [],
    can("project:read")
      ? Project.find({
          $and: [projectScope(actor), { archivedAt: null }, searchFilter(["name", "code"], q)],
        })
          .select("name code status")
          .limit(LIMIT)
          .lean()
      : [],
    can("proposal:read")
      ? Proposal.find({
          $and: [proposalScope(actor), { archivedAt: null }, searchFilter(["number", "title"], q)],
        })
          .select("number title status")
          .limit(LIMIT)
          .lean()
      : [],
    can("invoice:read")
      ? Invoice.find({ archivedAt: null, ...searchFilter(["number"], q) })
          .select("number status")
          .limit(LIMIT)
          .lean()
      : [],
    can("task:read")
      ? Task.find({ $and: [taskScope(actor), { deletedAt: null }, searchFilter(["title"], q)] })
          .select("title status")
          .limit(LIMIT)
          .lean()
      : [],
  ]);

  sendOk(res, [
    ...leads.map((l) => ({
      type: "lead",
      id: l._id,
      title: l.fullName,
      subtitle: l.companyName,
      status: l.status,
      href: `/leads/${l._id}`,
    })),
    ...clients.map((c) => ({
      type: "client",
      id: c._id,
      title: c.name,
      subtitle: c.companyName,
      status: c.status,
      href: `/clients/${c._id}`,
    })),
    ...projects.map((p) => ({
      type: "project",
      id: p._id,
      title: p.name,
      subtitle: p.code,
      status: p.status,
      href: `/projects/${p._id}`,
    })),
    ...proposals.map((p) => ({
      type: "proposal",
      id: p._id,
      title: p.title,
      subtitle: p.number,
      status: p.status,
      href: `/proposals/${p._id}`,
    })),
    ...invoices.map((i) => ({
      type: "invoice",
      id: i._id,
      title: i.number,
      subtitle: "",
      status: i.status,
      href: `/invoices/${i._id}`,
    })),
    ...tasks.map((t) => ({
      type: "task",
      id: t._id,
      title: t.title,
      subtitle: "",
      status: t.status,
      href: `/tasks?task=${t._id}`,
    })),
  ]);
});
