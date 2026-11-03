import type { PipelineStage } from "../../config/constants.js";
import { AppError } from "../../utils/http.js";

/** Pipeline rules, kept pure so they can be tested without a database. */
export function assertTransition(
  from: PipelineStage,
  to: PipelineStage,
  context: { lostReason?: string; hasProject: boolean },
) {
  if (from === to) throw AppError.badRequest(`The opportunity is already in ${to}`);
  if (to === "LOST" && !context.lostReason?.trim()) {
    throw AppError.badRequest("A lost reason is required to mark an opportunity as LOST");
  }
  if (from === "WON" && context.hasProject) {
    throw AppError.conflict("This opportunity has a project, so it cannot leave WON");
  }
}

/** A system-driven advance (e.g. from a proposal) only moves forward and never overrides an outcome. */
export function shouldAutoAdvance(from: PipelineStage, to: PipelineStage) {
  const order: PipelineStage[] = [
    "NEW",
    "CONTACTED",
    "INTERESTED",
    "MEETING_SCHEDULED",
    "PROPOSAL_SENT",
    "NEGOTIATION",
    "WON",
  ];
  if (from === "WON" || from === "LOST") return false;
  return order.indexOf(to) > order.indexOf(from);
}

export function conversionRate(won: number, lost: number) {
  const closed = won + lost;
  return closed === 0 ? 0 : Math.round((won / closed) * 1000) / 10;
}
