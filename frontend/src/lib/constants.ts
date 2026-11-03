export const CURRENCIES = ["INR", "USD", "GBP", "EUR", "AED", "CAD", "AUD"] as const;
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
export const INVOICE_STATUSES = [
  "DRAFT",
  "SENT",
  "PARTIALLY_PAID",
  "PAID",
  "OVERDUE",
  "CANCELLED",
] as const;
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
export const ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "SALES",
  "PROJECT_MANAGER",
  "DEVELOPER",
  "FINANCE",
] as const;
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

export const RANGE_PRESETS = [
  { value: "today", label: "Today" },
  { value: "last_7_days", label: "Last 7 days" },
  { value: "last_30_days", label: "Last 30 days" },
  { value: "this_month", label: "This month" },
  { value: "last_month", label: "Last month" },
  { value: "this_year", label: "This year" },
  { value: "custom", label: "Custom range" },
] as const;

const SPECIAL_LABELS: Record<string, string> = {
  GOODFIRMS: "GoodFirms",
  LINKEDIN: "LinkedIn",
  LINKEDIN_MESSAGE: "LinkedIn message",
  WHATSAPP: "WhatsApp",
  E_COMMERCE: "E-commerce",
  AI_DEVELOPMENT: "AI development",
  AI_CHATBOTS: "AI chatbots",
  API_DEVELOPMENT: "API development",
  SAAS_DEVELOPMENT: "SaaS development",
  PAYPAL: "PayPal",
  SWIFT: "SWIFT",
  TODO: "To do",
  MAINTENANCE_SUPPORT: "Maintenance and support",
  FULL_STACK_DEVELOPMENT: "Full-stack development",
};

/** Turns an enum value like MEETING_SCHEDULED into "Meeting scheduled". */
export function label(value?: string | null) {
  if (!value) return "";
  if (SPECIAL_LABELS[value]) return SPECIAL_LABELS[value];
  const words = value.replaceAll("_", " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const toOptions = (values: readonly string[]) =>
  values.map((value) => ({ value, label: label(value) }));
export const COMMON_TIMEZONES: string[] =
  typeof Intl.supportedValuesOf === "function"
    ? Intl.supportedValuesOf("timeZone")
    : ["UTC", "Asia/Kolkata"];
