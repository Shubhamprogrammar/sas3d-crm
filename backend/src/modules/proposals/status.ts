import { AppError } from "../../utils/http.js";

const ALLOWED: Record<string, string[]> = {
  DRAFT: ["SENT"],
  SENT: ["VIEWED", "ACCEPTED", "REJECTED", "EXPIRED"],
  VIEWED: ["ACCEPTED", "REJECTED", "EXPIRED"],
  EXPIRED: ["SENT"],
  REJECTED: ["SENT"],
  ACCEPTED: [],
};

export function assertProposalTransition(from: string, to: string) {
  if (!ALLOWED[from]?.includes(to))
    throw AppError.conflict(`A ${from} proposal cannot become ${to}`);
}

/** Accepted proposals are a commercial record; any other state can still be revised. */
export const isEditable = (status: string) => status !== "ACCEPTED";
