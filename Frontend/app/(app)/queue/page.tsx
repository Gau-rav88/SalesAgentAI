"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { OutreachReviewPanel } from "@/components/queue/outreach-review-panel";
import { queueService } from "@/services/queue.service";
import { ApiError } from "@/services/api-client";
import { cn } from "@/lib/utils";
import type { OutreachDraft } from "@/types";

const STATUS_DOT: Record<OutreachDraft["status"], string> = {
  pending: "bg-amber-400",
  approved: "bg-emerald-400",
  rejected: "bg-red-400",
  edited: "bg-white/40",
};

export default function QueuePage() {
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    queueService
      .list()
      .then((data) => {
        if (cancelled) return;
        setDrafts(data);
        if (data.length > 0) setSelectedId(data[0].id);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(
            err instanceof ApiError
              ? err.message || "Could not load the outreach queue."
              : "Could not reach the backend. Make sure the FastAPI server is running.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleApprove(id: string) {
    const updated = await queueService.approve(id);
    setDrafts((prev) => prev.map((d) => (d.id === id ? updated : d)));
  }

  async function handleReject(id: string) {
    const updated = await queueService.reject(id);
    setDrafts((prev) => prev.map((d) => (d.id === id ? updated : d)));
  }

  const selectedIndex = drafts.findIndex((d) => d.id === selectedId);
  const selectedDraft = selectedIndex >= 0 ? drafts[selectedIndex] : null;

  function goPrev() {
    if (drafts.length === 0) return;
    const nextIndex = selectedIndex <= 0 ? drafts.length - 1 : selectedIndex - 1;
    setSelectedId(drafts[nextIndex].id);
  }

  function goNext() {
    if (drafts.length === 0) return;
    const nextIndex = selectedIndex >= drafts.length - 1 ? 0 : selectedIndex + 1;
    setSelectedId(drafts[nextIndex].id);
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-medium text-white/70">Outreach Queue</h2>
        <p className="text-xs text-white/35">
          Every draft is grounded in evidence and confidence-scored. Nothing sends without your approval.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-10 text-sm text-white/40">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading outreach queue…
        </div>
      )}

      {!loading && error && <p className="py-10 text-sm text-red-400">{error}</p>}

      {!loading && !error && drafts.length === 0 && (
        <p className="py-10 text-sm text-white/40">
          No drafts queued yet — execute a recommendation from the Recommendation Center, or
          generate one from a company&apos;s Executive Report once an analysis is approved by the
          Guardrail agent.
        </p>
      )}

      {!loading && !error && drafts.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[240px_1fr]">
          <div className="space-y-1.5">
            <p className="px-1 text-[11px] text-white/30">{drafts.length} drafts</p>
            {drafts.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedId(d.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors",
                  d.id === selectedId
                    ? "border-white/15 bg-white/[0.06]"
                    : "border-white/6 bg-white/[0.015] hover:bg-white/[0.03]",
                )}
              >
                <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", STATUS_DOT[d.status])} />
                <div className="min-w-0">
                  <p className="truncate text-[12px] text-white/80">{d.companyName}</p>
                  <p className="truncate text-[11px] text-white/35">{d.stakeholderName}</p>
                </div>
              </button>
            ))}
          </div>

          {selectedDraft && (
            <OutreachReviewPanel
              draft={selectedDraft}
              index={selectedIndex}
              total={drafts.length}
              onPrev={goPrev}
              onNext={goNext}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          )}
        </div>
      )}
    </div>
  );
}
