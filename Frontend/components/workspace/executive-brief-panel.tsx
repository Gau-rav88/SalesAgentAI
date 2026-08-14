"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScoreRing } from "@/components/common/score-ring";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { accountsService } from "@/services/accounts.service";
import type { Company } from "@/types";
import type { OverallAssessment, KnowledgeData } from "@/services/workspace.service";

interface ExecutiveBriefPanelProps {
  assessment: OverallAssessment | null;
  knowledge: KnowledgeData | null;
}

export function ExecutiveBriefPanel({ assessment, knowledge }: ExecutiveBriefPanelProps) {
  if (!assessment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Executive Brief</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] leading-relaxed text-white/40">
            No analysis yet. Send a company brief or notes in the chat and the executive summary will
            appear here once the pipeline finishes.
          </p>
        </CardContent>
      </Card>
    );
  }

  const score = Math.round((assessment.intent_score ?? 0) * (assessment.intent_score <= 1 ? 100 : 1));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Executive Brief — {assessment.company || knowledge?.company || "Unknown"}</CardTitle>
        <ScoreRing score={score} size={54} label="" />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[13px] leading-relaxed text-white/50">
          {assessment.overall_recommendation || "No recommendation returned by the guardrail agent."}
        </p>
        <div className="flex flex-wrap gap-2">
          {assessment.risk_level && (
            <Badge variant={assessment.risk_level.toLowerCase() === "high" ? "danger" : "outline"}>
              {assessment.risk_level} risk
            </Badge>
          )}
          {assessment.approved ? (
            <Badge variant="success">Approved</Badge>
          ) : (
            <Badge variant="danger">Needs review</Badge>
          )}
          {assessment.buying_stage && <Badge variant="outline">{assessment.buying_stage}</Badge>}
          {assessment.decision_maker && <Badge variant="outline">{assessment.decision_maker}</Badge>}
        </div>
        {assessment.next_action && (
          <p className="text-xs text-white/40">
            Next action: <span className="text-white/70">{assessment.next_action}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function HistorySidebar({
  onSelectCompany,
  activeCompanyId,
}: {
  onSelectCompany?: (companyId: string) => void;
  activeCompanyId?: string | null;
}) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    accountsService
      .list()
      .then((data) => {
        if (!cancelled) setCompanies(data);
      })
      .catch(() => {
        // Keep the sidebar empty rather than surfacing an error here —
        // it's a secondary panel, not the primary action on this page.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Recent Sessions</CardTitle>
      </CardHeader>
      <ScrollArea className="flex-1 px-2 pb-4">
        <div className="space-y-1 px-3">
          {loading && <p className="px-2 py-2 text-xs text-white/30">Loading…</p>}

          {!loading && companies.length === 0 && (
            <p className="px-2 py-2 text-xs text-white/30">
              Nothing analyzed yet — send a brief in the chat to start your first session.
            </p>
          )}

          {companies.map((company) => (
            <button
              key={company.id}
              type="button"
              onClick={() => onSelectCompany?.(company.id)}
              className={`flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-xs transition-colors ${
                activeCompanyId === company.id
                  ? "bg-white/[0.06] text-white/85"
                  : "text-white/45 hover:bg-white/[0.04] hover:text-white/80"
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/[0.06] text-[10px] text-white/60">
                  {company.logoInitial}
                </span>
                {company.name}
              </span>
              <span className="text-[10px] text-white/25">{company.score}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}