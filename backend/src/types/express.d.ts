import type { Role } from "../config/constants.js";

export interface Actor {
  id: string;
  name: string;
  email: string;
  role: Role;
  ip: string;
}

declare global {
  namespace Express {
    interface Request {
      actor?: Actor;
    }
  }
}
