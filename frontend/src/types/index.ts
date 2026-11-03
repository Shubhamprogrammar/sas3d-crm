export interface UserRef {
  _id: string;
  name: string;
  email?: string;
  image?: string | null;
  role?: string;
  designation?: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export interface Preferences {
  defaultCurrency: string;
  timezone: string;
  dateFormat: string;
  timeFormat: "12h" | "24h";
  theme: "light" | "dark" | "system";
}

export interface Me {
  user: UserRef & {
    phone: string;
    status: string;
    skills: string[];
    mutedNotifications: string[];
    role: string;
    email: string;
  };
  permissions: string[];
  preferences: Preferences;
  companyName: string;
}

interface Ref {
  _id: string;
  name?: string;
}

export interface Lead {
  _id: string;
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  whatsapp: string;
  country: string;
  state: string;
  city: string;
  timezone: string;
  website: string;
  linkedinUrl: string;
  source: string;
  interestedServices: (Ref & { category?: string })[];
  estimatedBudget: number;
  budgetCurrency: string;
  priority: string;
  status: string;
  assignedTo: UserRef | null;
  description: string;
  requirements: string;
  internalNotes: string;
  lastContactedAt: string | null;
  nextFollowUpAt: string | null;
  opportunity: {
    _id: string;
    stage: string;
    project?: string | null;
    client?: string | null;
    value: number;
    currency: string;
    lostReason?: string;
  } | null;
  convertedClient: { _id: string; name: string; companyName: string } | null;
  archivedAt: string | null;
  createdAt: string;
}

export interface OpportunityCard {
  _id: string;
  title: string;
  lead: string | null;
  client: string | { _id: string; name: string } | null;
  project: string | { _id: string; name: string; code: string } | null;
  contactName: string;
  companyName: string;
  country: string;
  stage: string;
  value: number;
  currency: string;
  service: Ref | null;
  assignedTo: UserRef | null;
  priority: string;
  nextFollowUpAt: string | null;
  lostReason: string;
}

export interface BoardColumn {
  stage: string;
  count: number;
  totals: { currency: string; amount: number }[];
  cards: OpportunityCard[];
}

export interface Board {
  columns: BoardColumn[];
  conversionRate: number;
}

export interface Address {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface Client {
  _id: string;
  name: string;
  companyName: string;
  type: string;
  email: string;
  phone: string;
  website: string;
  country: string;
  city: string;
  timezone: string;
  billingAddress: Address;
  tax: { idType?: string; idNumber?: string };
  status: string;
  notes: string;
  relationshipManager: UserRef | null;
  sourceLead: { _id: string; fullName: string } | null;
  lastInteractionAt: string | null;
  createdAt: string;
  summary?: {
    totalProjects: number;
    activeProjects: number;
    financials: { currency: string; billed: number; received: number; outstanding: number }[];
  };
}

export interface Task {
  _id: string;
  title: string;
  description: string;
  lead: { _id: string; fullName: string } | null;
  client: { _id: string; name: string } | null;
  project: { _id: string; name: string; code: string } | null;
  assignedTo: UserRef | null;
  priority: string;
  dueAt: string | null;
  hasDueTime: boolean;
  status: string;
  completedAt: string | null;
  createdAt: string;
}

export interface Activity {
  _id: string;
  kind: "SYSTEM" | "COMMUNICATION";
  action: string;
  commType: string | null;
  subject: string;
  description: string;
  occurredAt: string;
  nextFollowUpAt: string | null;
  actor: UserRef | null;
}

export interface LineItem {
  service?: string | Ref | null;
  description: string;
  quantity: number;
  unitPrice: number;
  amount?: number;
}

export interface Discount {
  type: "PERCENT" | "FIXED";
  value: number;
}

export interface Totals {
  lineAmounts: number[];
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
}

export interface Proposal {
  _id: string;
  number: string;
  client: { _id: string; name: string; companyName?: string; email?: string } | null;
  lead: { _id: string; fullName: string; companyName?: string; email?: string } | null;
  opportunity: { _id: string; title: string; stage: string } | string | null;
  title: string;
  description: string;
  scope: string;
  deliverables: string[];
  technologies: string[];
  timeline: string;
  items: LineItem[];
  currency: string;
  discount: Discount;
  taxRateBp: number;
  taxLabel: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentTerms: string;
  validUntil: string | null;
  terms: string;
  notes: string;
  status: string;
  revision: number;
  sentAt: string | null;
  viewedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
  createdBy: UserRef | null;
  createdAt: string;
}

export interface ProposalRevision {
  _id: string;
  revision: number;
  snapshot: Proposal;
  changedBy: UserRef | null;
  createdAt: string;
}

export interface Project {
  _id: string;
  name: string;
  code: string;
  client: { _id: string; name: string; companyName?: string; country?: string };
  description: string;
  category: string;
  budget: number;
  currency: string;
  startDate: string | null;
  expectedDeliveryDate: string | null;
  actualCompletionDate: string | null;
  projectManager: UserRef | null;
  team: UserRef[];
  priority: string;
  status: string;
  githubUrl: string;
  stagingUrl: string;
  productionUrl: string;
  documentationUrl: string;
  internalNotes: string;
  progress: number;
  milestoneCount: number;
  milestonesCompleted: number;
  taskCount: number;
  tasksCompleted: number;
}

export interface Milestone {
  _id: string;
  project: string;
  title: string;
  description: string;
  startDate: string | null;
  dueDate: string | null;
  status: string;
  completedAt: string | null;
}

export interface ProjectTask {
  _id: string;
  project: string;
  milestone: string | null;
  parentTask: string | null;
  title: string;
  description: string;
  assignedTo: UserRef | null;
  priority: string;
  dueDate: string | null;
  status: string;
}

export interface ProjectUpdate {
  _id: string;
  type: string;
  content: string;
  author: UserRef | null;
  createdAt: string;
}

export interface Payment {
  _id: string;
  invoice: string | { _id: string; number: string };
  client: string | { _id: string; name: string };
  amount: number;
  currency: string;
  paymentDate: string;
  method: string;
  transactionReference: string;
  notes: string;
  recordedBy: UserRef | null;
  voidedAt: string | null;
  voidReason: string;
}

export interface Invoice {
  _id: string;
  number: string;
  client: { _id: string; name: string; companyName?: string; email?: string; country?: string };
  project: { _id: string; name: string; code: string } | null;
  issueDate: string;
  dueDate: string;
  currency: string;
  items: LineItem[];
  discount: Discount;
  taxRateBp: number;
  taxLabel: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  amountPaid: number;
  amountDue: number;
  paymentTerms: string;
  notes: string;
  status: string;
  sentAt: string | null;
  cancelReason: string;
  payments?: Payment[];
}

export interface Service {
  _id: string;
  name: string;
  description: string;
  category: string;
  startingPrice: number;
  currency: string;
  pricingModel: string;
  estimatedDelivery: string;
  technologies: string[];
  isActive: boolean;
}

export interface TeamMember extends UserRef {
  email: string;
  phone: string;
  role: string;
  status: string;
  designation: string;
  joiningDate: string | null;
  skills: string[];
}

export interface TeamMemberDetail extends TeamMember {
  leads: { _id: string; fullName: string; companyName: string; status: string }[];
  projects: { _id: string; name: string; code: string; status: string }[];
  tasks: { _id: string; title: string; dueAt: string | null; priority: string; status: string }[];
  stats: { pendingTasks: number; completedTasks: number; completionRate: number };
}

export interface Notification {
  _id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  readAt: string | null;
  createdAt: string;
}

export interface Attachment {
  _id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploadedBy: UserRef | null;
  createdAt: string;
}

export interface SearchResult {
  type: string;
  id: string;
  title: string;
  subtitle: string;
  status: string;
  href: string;
}

export interface CountRow {
  key: string;
  count: number;
}

export interface MoneyRow {
  currency: string;
  invoiced: number;
  collected: number;
  outstanding: number;
}

export interface Dashboard {
  range: { from: string; to: string };
  leads: {
    total: number;
    newInRange: number;
    active: number;
    overdueFollowUps: number;
    overTime: { period: string; count: number }[];
    bySource: CountRow[];
    byCountry: CountRow[];
    recent: Pick<Lead, "_id" | "fullName" | "companyName" | "country" | "status" | "createdAt">[];
    upcomingFollowUps: Pick<
      Lead,
      "_id" | "fullName" | "companyName" | "nextFollowUpAt" | "timezone"
    >[];
  } | null;
  clients: { total: number; active: number } | null;
  projects: {
    active: number;
    completed: number;
    statusDistribution: CountRow[];
    activeList: {
      _id: string;
      name: string;
      code: string;
      status: string;
      expectedDeliveryDate: string | null;
      progress: number;
      client: { name: string } | null;
    }[];
  } | null;
  tasks: {
    pending: number;
    overdue: number;
    upcoming: { _id: string; title: string; dueAt: string; priority: string }[];
  } | null;
  proposals: { sent: number; accepted: number; conversionRate: number } | null;
  finance: {
    byCurrency: MoneyRow[];
    revenueOverTime: { period: string; currency: string; amount: number }[];
    revenueByService: { service: string; currency: string; amount: number }[];
    openInvoices: {
      _id: string;
      number: string;
      currency: string;
      amountDue: number;
      dueDate: string;
      status: string;
      client: { name: string } | null;
    }[];
  } | null;
  recentActivities: {
    _id: string;
    description: string;
    occurredAt: string;
    actor: UserRef | null;
  }[];
}
