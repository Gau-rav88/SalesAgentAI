import type { BuyingSignal, Company, PainPoint, Stakeholder, ResearchStatus } from "@/types";
import { getCompanyById } from "@/lib/mock-data";
import { workspaceService, type WorkspaceCompanySummary } from "./workspace.service";

/**
 * Company-level list, stakeholders, pain points, and buying signals all
 * come from the real backend now (GET /workspace/...), derived from
 * whatever you've actually run through the AI Workspace chat. The
 * mock-data fallback in getById only applies to demo company ids that
 * were never run through the pipeline (e.g. straight from the landing
 * page mock deck).
 */
function toCompany(summary: WorkspaceCompanySummary): Company {
  return {
    id: String(summary.company_id),
    name: summary.company,
    industry: summary.industry || "Unknown",
    employees: "—",
    revenue: "—",
    score: Math.round(summary.latest_intent ?? 0),
    status: (summary.total_analyses > 0 ? "analyzed" : "queued") as ResearchStatus,
    country: "—",
    logoInitial: summary.company?.[0]?.toUpperCase() ?? "?",
  };
}

export const accountsService = {
  async list(): Promise<Company[]> {
    const summaries = await workspaceService.listCompanies();
    return summaries.map(toCompany);
  },

  async getById(id: string): Promise<Company | undefined> {
    const all = await accountsService.list();
    return all.find((c) => c.id === id) ?? getCompanyById(id);
  },

  async getStakeholders(companyId: string): Promise<Stakeholder[]> {
    return workspaceService.getStakeholders(companyId) as Promise<Stakeholder[]>;
  },

  async getPainPoints(companyId: string): Promise<PainPoint[]> {
    return workspaceService.getPainPoints(companyId) as Promise<PainPoint[]>;
  },

  async getBuyingSignals(companyId: string): Promise<BuyingSignal[]> {
    return workspaceService.getBuyingSignals(companyId) as Promise<BuyingSignal[]>;
  },
};