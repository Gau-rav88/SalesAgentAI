import { apiFetch } from "./api-client";
import type { Recommendation } from "@/types";

/**
 * Raw shape returned by GET /workspace/recommendations
 * (backend/app/api/workspace.py). Real, DB-backed — every field here
 * is derived from an actual AnalysisResult, never invented client-side.
 */
interface RecommendationApiResult {
  analysis_id: number;
  company_id: number;
  company: string;
  website: string;
  industry: string;
  score: number;
  priority: string;
  intent: number;
  buying_stage: string;
  risk_level: string;
  decision_maker: string;
  confidence: number;
  next_action: string;
  reason: string[];
  created_at: string;
}

function toRecommendation(raw: RecommendationApiResult): Recommendation {
  return {
    analysisId: String(raw.analysis_id),
    companyId: String(raw.company_id),
    company: raw.company,
    website: raw.website || "",
    industry: raw.industry || "",
    score: raw.score ?? 0,
    priority: raw.priority || "",
    intent: raw.intent ?? 0,
    buyingStage: raw.buying_stage || "",
    riskLevel: raw.risk_level || "",
    decisionMaker: raw.decision_maker || "",
    confidence: raw.confidence ?? 0,
    nextAction: raw.next_action || "",
    reasons: raw.reason || [],
    createdAt: raw.created_at,
  };
}

export const recommendationsService = {
  /** Every company's most recent analysis, scored and ranked, optionally scoped to one company. */
  async list(companyId?: string | number): Promise<Recommendation[]> {
    const qs = companyId ? `?company_id=${companyId}` : "";
    const data = await apiFetch<{ recommended_companies: RecommendationApiResult[] }>(
      `/workspace/recommendations${qs}`,
    );
    return (data.recommended_companies || []).map(toRecommendation);
  },
};
