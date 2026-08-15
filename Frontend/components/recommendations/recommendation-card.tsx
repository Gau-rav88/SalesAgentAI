"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Loader2, ArrowRight, Check, ExternalLink, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScoreRing } from "@/components/common/score-ring";
import { workspaceService } from "@/services/workspace.service";
import { queueService } from "@/services/queue.service";
import { recommendationsService } from "@/services/recommendations.service";
import { ApiError } from "@/services/api-client";
import type { Recommendation, Stakeholder, StrategyOption, PurposeStrategy } from "@/types";
import { cn } from "@/lib/utils";

const PRIORITY_VARIANT: Record<string, "success" | "warning" | "danger" | "outline"> = {
  High: "danger",
  Medium: "warning",
  Low: "outline",
};

const INTENT_LEVEL_VARIANT: Record<string, "success" | "warning" | "outline"> = {
  HIGH: "success",
  MEDIUM: "warning",
  LOW: "outline",
};

export function RecommendationCard({
  recommendation,
  onExecuted,
}: {
  recommendation: Recommendation;
  onExecuted?: (companyId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [stakeholders, setStakeholders] = useState<Stakeholder[] | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  // The strategy the user has selected from this account's intent-tier
  // options — defaults to the AI's recommended one, but nothing is
  // executed until the user confirms it via "Approve & Generate Draft".
  const [selectedStrategyKey, setSelectedStrategyKey] = useState<string | undefined>(
    recommendation.recommendedStrategy?.key,
  );

  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState(false);
  const [executeError, setExecuteError] = useState<string | null>(null);


  const [selectedPurpose, setSelectedPurpose] = useState<string | undefined>();
  const [purposeStrategy, setPurposeStrategy] = useState<PurposeStrategy | null>(
    recommendation.purposeStrategy,
  );
  const [loadingPurpose, setLoadingPurpose] = useState(false);

  async function handleSelectPurpose(key: string) {
    if (key === selectedPurpose) return;
    setSelectedPurpose(key);
    setLoadingPurpose(true);
    try {
      const [updated] = await recommendationsService.list(recommendation.companyId, key);
      setPurposeStrategy(updated?.purposeStrategy ?? null);
    } catch {
      setPurposeStrategy({
        purpose: key,
        insufficientEvidence: true,
        message: "Could not load this outreach type — try again.",
      });
    } finally {
      setLoadingPurpose(false);
    }
  }

  async function handleExpand() {
    const next = !expanded;
    setExpanded(next);

    if (next && stakeholders === null && !loadingDetails) {
      setLoadingDetails(true);
      setDetailsError(null);
      try {
        const data = await workspaceService.getStakeholders(recommendation.companyId);
        setStakeholders(data as Stakeholder[]);
      } catch (err) {
        setDetailsError(
          err instanceof ApiError
            ? err.message || "Could not load supporting evidence."
            : "Could not reach the backend.",
        );
      } finally {
        setLoadingDetails(false);
      }
    }
  }

  async function handleExecute() {
    setExecuting(true);
    setExecuteError(null);
    try {
      
      await queueService.generate(recommendation.analysisId);
      setExecuted(true);
      onExecuted?.(recommendation.companyId);
    } catch (err) {
      setExecuteError(
        err instanceof ApiError
          ? err.message || "Could not create an outreach draft."
          : "Could not reach the backend.",
      );
    } finally {
      setExecuting(false);
    }
  }

  const selectedOption: StrategyOption | undefined =
    recommendation.strategyOptions.find((o) => o.key === selectedStrategyKey) ??
    recommendation.recommendedStrategy ??
    undefined;

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-medium text-white/90">{recommendation.company}</h3>
              <Badge variant={INTENT_LEVEL_VARIANT[recommendation.intentLevel] ?? "outline"}>
                {recommendation.intentLevel} INTENT — {recommendation.intentScore}/100
              </Badge>
              {recommendation.priority && (
                <Badge variant={PRIORITY_VARIANT[recommendation.priority] ?? "outline"}>
                  {recommendation.priority} Priority
                </Badge>
              )}
              {recommendation.buyingStage && <Badge variant="outline">{recommendation.buyingStage}</Badge>}
            </div>

            <p className="text-[13px] leading-relaxed text-white/60">
              {recommendation.whyThisRecommendation ||
                recommendation.nextAction ||
                "No recommended action available for this account yet."}
            </p>

            {recommendation.availablePurposes.length > 0 && (
              <div className="pt-1">
                <p className="mb-1.5 text-[10px] uppercase tracking-wider text-white/30">Outreach Purpose</p>
                <div className="flex flex-wrap gap-1.5">
                  {recommendation.availablePurposes.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => handleSelectPurpose(p.key)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                        selectedPurpose === p.key
                          ? "border-white/30 bg-white/[0.08] text-white/90"
                          : "border-white/8 bg-white/[0.02] text-white/45 hover:border-white/15 hover:text-white/70",
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                {loadingPurpose && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12px] text-white/35">
                    <Loader2 className="h-3 w-3 animate-spin" /> Matching strategy to this purpose…
                  </p>
                )}

                {!loadingPurpose && purposeStrategy && (
                  <div className="mt-2 rounded-lg border border-white/8 bg-white/[0.02] p-2.5">
                    {purposeStrategy.insufficientEvidence ? (
                      <p className="flex items-start gap-1.5 text-[12px] text-amber-400/90">
                        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        {purposeStrategy.message || "Insufficient evidence for this outreach type."}
                      </p>
                    ) : (
                      <>
                        <p className="text-[12px] font-semibold text-white/85">{purposeStrategy.name}</p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
                          {purposeStrategy.description}
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}

            {!recommendation.evidenceSufficient && (
              <div className="flex items-start gap-1.5 text-[12px] text-amber-400/90">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>Limited evidence found for this account — treat this recommendation cautiously.</span>
              </div>
            )}

            {recommendation.reasons.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {recommendation.reasons.map((r) => (
                  <span
                    key={r}
                    className="rounded-full border border-white/8 bg-white/[0.02] px-2.5 py-1 text-[11px] text-white/40"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-white/30">Confidence</p>
              <p className="text-lg font-semibold text-white/90">{recommendation.confidence}%</p>
            </div>

            {executed ? (
              <Badge variant="success">
                <Check className="h-3 w-3" /> Draft queued
              </Badge>
            ) : (
              <Button size="sm" onClick={handleExecute} disabled={executing}>
                {executing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Approve &amp; Generate Draft
                {!executing && <ArrowRight className="h-3.5 w-3.5" />}
              </Button>
            )}

            <button
              onClick={handleExpand}
              className="rounded-lg border border-white/8 p-1.5 text-white/40 transition-colors hover:text-white/80"
              aria-label="Toggle details"
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} />
            </button>
          </div>
        </div>

        {executeError && (
          <p className="border-t border-white/6 px-5 py-2 text-[11px] text-red-400">{executeError}</p>
        )}

        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="border-t border-white/6 bg-white/[0.015] px-5 py-4"
          >
            {/* Recommended outreach strategy — a choice, not an automatic action */}
            {recommendation.strategyOptions.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">
                  Recommended Strategy — select before approving
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {recommendation.strategyOptions.map((option) => {
                    const isSelected = option.key === selectedOption?.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setSelectedStrategyKey(option.key)}
                        className={cn(
                          "rounded-lg border p-3 text-left transition-colors",
                          isSelected
                            ? "border-white/30 bg-white/[0.06]"
                            : "border-white/8 bg-white/[0.015] hover:border-white/15",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[12px] font-medium text-white/85">{option.name}</p>
                          {option.recommended && (
                            <Badge variant="outline" className="shrink-0 text-[10px]">
                              AI pick
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-white/45">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Why AI Suggested This</p>
                <ul className="space-y-1.5 text-[12px] leading-relaxed text-white/55">
                  <li className="flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/30" />
                    {recommendation.whyThisRecommendation}
                  </li>
                  {recommendation.reasons.map((r) => (
                    <li key={r} className="flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/30" />
                      {r}
                    </li>
                  ))}
                  {recommendation.decisionMaker && (
                    <li className="flex items-start gap-1.5">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-white/30" />
                      Stakeholder: {recommendation.decisionMaker}
                    </li>
                  )}
                </ul>
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Supporting Evidence</p>
                {!recommendation.evidenceSufficient && recommendation.evidence.length === 0 && (
                  <p className="text-[12px] text-white/30">
                    No source-level evidence extracted yet — evidence is insufficient for a strong claim.
                  </p>
                )}
                {recommendation.evidence.length > 0 && (
                  <ul className="space-y-1.5 text-[12px] leading-relaxed text-white/55">
                    {recommendation.evidence.slice(0, 5).map((e, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-white/25" />
                        <span>{e.title || e.url}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {recommendation.painPoints.length > 0 && (
                  <>
                    <p className="mb-1.5 mt-3 text-[10px] uppercase tracking-wider text-white/30">Pain Points</p>
                    <ul className="space-y-1 text-[12px] leading-relaxed text-white/55">
                      {recommendation.painPoints.slice(0, 3).map((p, i) => (
                        <li key={i}>· {p}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <div>
                <p className="mb-2 text-[10px] uppercase tracking-wider text-white/30">Related Stakeholders</p>
                {loadingDetails && (
                  <div className="flex items-center gap-2 text-[12px] text-white/35">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
                  </div>
                )}
                {detailsError && <p className="text-[12px] text-red-400">{detailsError}</p>}
                {!loadingDetails && !detailsError && stakeholders?.length === 0 && (
                  <p className="text-[12px] text-white/30">No stakeholders extracted yet.</p>
                )}
                {!loadingDetails && stakeholders && stakeholders.length > 0 && (
                  <ul className="space-y-2">
                    {stakeholders.slice(0, 4).map((s) => (
                      <li key={s.id} className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[12px] text-white/75">{s.name}</p>
                          <p className="truncate text-[11px] text-white/35">{s.title}</p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {s.influence}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-white/6 pt-3">
              <div className="flex items-center gap-3 text-[11px] text-white/30">
                <span>Risk: {recommendation.riskLevel || "—"}</span>
                <span>·</span>
                <span>Intent score: {recommendation.intentScore}</span>
                <span>·</span>
                <span>Overall score: {recommendation.score}/100</span>
              </div>
              <ScoreRing score={recommendation.confidence} size={44} label="" />
            </div>
          </motion.div>
        )}
      </Card>
    </motion.div>
  );
}

