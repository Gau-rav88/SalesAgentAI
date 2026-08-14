export type ResearchStatus = "analyzed" | "in-review" | "queued";

export interface Company {
  id: string;
  name: string;
  industry: string;
  employees: string;
  revenue: string;
  score: number;
  status: ResearchStatus;
  country: string;
  logoInitial?: string;
}

export type StakeholderInfluence =
  | "Decision Maker"
  | "Champion"
  | "Budget Holder"
  | "Influencer"
  | "Blocker";

export interface Stakeholder {
  id: string;
  name: string;
  title: string;
  dept: string;
  influence: StakeholderInfluence;
  score: number;
  linkedin: boolean;
  email: string;
  companyId: string;
  evidence?: string[];
  painPoints?: string[];
  buyingSignals?: string[];
}

export type Severity = "critical" | "high" | "medium" | "low";

export interface PainPoint {
  id: string;
  title: string;
  severity: Severity;
  confidence: number;
  sources: number;
  excerpt: string;
  companyId?: string;
}

export interface BuyingSignal {
  id: string;
  title: string;
  strength: "strong" | "moderate" | "weak";
  detectedAt: string;
  source: string;
}

export type AuditAgent =
  | "Orchestrator"
  | "WebCrawler"
  | "PeopleIntel"
  | "ReasonEngine"
  | "StrategyAI"
  | "GuardrailAgent"
  | "QueueManager"
  | "IntentAgent"
  | "PersonaAgent";

export interface AuditEvent {
  id: string;
  event: string;
  agent: AuditAgent;
  time: string;
  timestamp: string;
  detail: string;
  status: "success" | "warning" | "info";
}

export type AgentStage =
  | "ingest"
  | "research"
  | "stakeholder"
  | "pain_point"
  | "buying_signal"
  | "strategy"
  | "guardrail"
  | "confidence"
  | "approval";

export interface AgentProgressStep {
  id: AgentStage;
  label: string;
  status: "pending" | "active" | "done" | "blocked";
  detail?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: string;
  /**
   * Optional presentation kind for the AI Workspace's live conversation.
   * Defaults to a plain text bubble when omitted, so existing consumers
   * (mock data, other screens) are unaffected.
   */
  kind?: "text" | "loading" | "stream" | "report";
  /** Chip labels shown under a user message, e.g. attached files/sources. */
  attachments?: string[];
  /** Ordered live steps for a "stream" message. */
  steps?: WorkspaceStreamStep[];
  /** Resource chips revealed so far for a "stream" message. */
  chips?: string[];
  /** Present when kind is "report" — drives the completion card. */
  report?: WorkspaceReportCompletion | null;
}

export interface WorkspaceStreamStep {
  id: string;
  label: string;
  status: "active" | "done" | "error";
  agent?: string;
}

export interface WorkspaceReportCompletion {
  company?: string;
  recommendation?: string;
  riskLevel?: string;
  buyingStage?: string;
  nextAction?: string;
  approved?: boolean;
  /** Analysis row this report was generated from — needed to POST /queue/generate/{analysisId}. */
  analysisId?: number;
  /** Company this report belongs to — needed to deep-link into the Relationship Graph. */
  companyId?: number | string;
}

export interface Recommendation {
  analysisId: string;
  companyId: string;
  company: string;
  website: string;
  industry: string;
  score: number;
  priority: string;
  intent: number;
  buyingStage: string;
  riskLevel: string;
  decisionMaker: string;
  confidence: number;
  nextAction: string;
  reasons: string[];
  createdAt: string;
}

export interface OutreachDraft {
  id: string;
  companyId: string;
  companyName: string;
  stakeholderName: string;
  channel: "email" | "linkedin" | "call-script";
  subject: string;
  body: string;
  confidence: number;
  reasoning: string;
  evidence: string[];
  status: "pending" | "approved" | "rejected" | "edited";
  createdAt: string;
}

export interface RelationshipNode {
  id: string;
  name: string;
  title: string;
  influence: StakeholderInfluence;
  confidence: number;
  evidence: string[];
  painPoints: string[];
  buyingSignals: string[];
  x?: number;
  y?: number;
}

export interface RelationshipEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface TrustDistributionPoint {
  bucket: string;
  count: number;
}

export interface ResearchActivityPoint {
  date: string;
  analyses: number;
}

export interface PainPointsByIndustryPoint {
  industry: string;
  count: number;
}

export interface ResearchStatusSlice {
  status: ResearchStatus;
  count: number;
}

export type NavKey =
  | "workspace"
  | "accounts"
  | "report"
  | "graph"
  | "recommendations"
  | "queue"
  | "audit"
  | "profile";