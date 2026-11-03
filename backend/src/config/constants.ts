export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "SALES",
  "PROJECT_MANAGER",
  "DEVELOPER",
  "FINANCE",
] as const;
export type Role = (typeof ROLES)[number];

export const USER_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export const CURRENCIES = ["INR", "USD", "GBP", "EUR", "AED", "CAD", "AUD"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const LEAD_SOURCES = [
  "WEBSITE",
  "LINKEDIN",
  "INSTAGRAM",
  "FACEBOOK",
  "UPWORK",
  "FIVERR",
  "REFERRAL",
  "COLD_EMAIL",
  "CLUTCH",
  "GOODFIRMS",
  "OTHER",
] as const;

export const PIPELINE_STAGES = [
  "NEW",
  "CONTACTED",
  "INTERESTED",
  "MEETING_SCHEDULED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const CLIENT_TYPES = [
  "INDIVIDUAL",
  "STARTUP",
  "SMALL_BUSINESS",
  "ENTERPRISE",
  "AGENCY",
] as const;
export const CLIENT_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const;

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export const COMMUNICATION_TYPES = [
  "EMAIL",
  "PHONE_CALL",
  "WHATSAPP",
  "MEETING",
  "LINKEDIN_MESSAGE",
  "INTERNAL_NOTE",
  "OTHER",
] as const;

export const PROPOSAL_STATUSES = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
] as const;

export const PROJECT_STATUSES = [
  "NOT_STARTED",
  "PLANNING",
  "IN_PROGRESS",
  "ON_HOLD",
  "TESTING",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
] as const;
export const MILESTONE_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;
export const PROJECT_UPDATE_TYPES = ["UPDATE", "WORK_NOTE", "CLIENT_FEEDBACK"] as const;

export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];
export const PAYMENT_METHODS = [
  "BANK_TRANSFER",
  "SWIFT",
  "PAYPAL",
  "PAYONEER",
  "STRIPE",
  "CASH",
  "OTHER",
] as const;

export const SERVICE_CATEGORIES = [
  "WEB_DEVELOPMENT",
  "FULL_STACK_DEVELOPMENT",
  "SAAS_DEVELOPMENT",
  "AI_DEVELOPMENT",
  "AI_CHATBOTS",
  "BUSINESS_AUTOMATION",
  "API_DEVELOPMENT",
  "E_COMMERCE",
  "MAINTENANCE_SUPPORT",
  "CUSTOM_SOFTWARE",
] as const;
export const PRICING_MODELS = ["FIXED", "HOURLY", "MONTHLY", "CUSTOM"] as const;

export const NOTIFICATION_TYPES = [
  "LEAD_ASSIGNED",
  "FOLLOW_UP_DUE",
  "FOLLOW_UP_OVERDUE",
  "TASK_ASSIGNED",
  "TASK_DEADLINE",
  "MILESTONE_APPROACHING",
  "PROJECT_STATUS_UPDATED",
  "PROPOSAL_ACCEPTED",
  "INVOICE_OVERDUE",
  "PAYMENT_RECORDED",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const RELATED_TYPES = [
  "LEAD",
  "OPPORTUNITY",
  "CLIENT",
  "PROJECT",
  "TASK",
  "PROPOSAL",
  "INVOICE",
  "PAYMENT",
  "SERVICE",
  "USER",
  "SETTINGS",
] as const;
export type RelatedType = (typeof RELATED_TYPES)[number];
