"use client";

import { useRef, useState } from "react";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { ExecutiveBriefPanel, HistorySidebar } from "@/components/workspace/executive-brief-panel";
import type { ComposerAttachment, WorkspaceMode } from "@/components/workspace/prompt-composer";
import {
  workspaceService,
  type AnalyzeResponse,
  type StreamFrame,
  type SupervisorResponse,
} from "@/services/workspace.service";
import { ApiError } from "@/services/api-client";
import type { ChatMessage, WorkspaceStreamStep } from "@/types";

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Send me a company brief, some notes, or a website summary and I'll run it through the research pipeline — knowledge extraction, persona, intent, strategy, and a guardrail check. Ask me a general question instead and I'll just answer it directly.",
  timestamp: new Date().toISOString(),
};

/** Resource chip shown for whatever the person actually attached in the composer. */
const CHIP_BY_KIND: Record<ComposerAttachment["kind"], string> = {
  pdf: "PDF",
  csv: "CSV",
  url: "Website",
  crm: "CRM",
  gmail: "Emails",
  drive: "Drive",
  notion: "Notion",
  calendar: "Calendar",
};

export function WorkspaceClient() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  function patchMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function reportFromAnalysis(analysis: AnalyzeResponse) {
    const assessment = analysis.overall_assessment;
    return {
      company: assessment?.company || analysis.knowledge?.company,
      recommendation: assessment?.overall_recommendation,
      riskLevel: assessment?.risk_level,
      buyingStage: assessment?.buying_stage,
      nextAction: assessment?.next_action,
      approved: assessment?.approved,
      analysisId: analysis.analysis_id,
      companyId: analysis.company_id,
    };
  }

  /**
   * "Recent Sessions" used to link out to /accounts/{id}. There's no
   * stored chat transcript to replay, but every session's full analysis
   * result IS stored (GET /analysis/{id}) — so reopening a session pulls
   * that company's most recent analysis back in as a report card right
   * inside the current conversation, instead of navigating away.
   */
  async function handleSelectCompany(companyId: string) {
    setActiveCompanyId(companyId);

    const noteId = `m-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: noteId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        kind: "loading",
      },
    ]);
    setSending(true);

    try {
      const dashboard = await workspaceService.getCompanyDashboard(companyId);

      if ("error" in dashboard) {
        patchMessage(noteId, { kind: "text", content: dashboard.error });
        return;
      }

      const analysis = await workspaceService.getAnalysis(dashboard.latest_analysis.analysis_id);
      setResult(analysis);

      patchMessage(noteId, {
        kind: "report",
        content: `Reopened your most recent session for ${dashboard.company.name}.`,
        report: reportFromAnalysis(analysis),
      });
    } catch (err) {
      patchMessage(noteId, {
        kind: "text",
        content:
          err instanceof ApiError
            ? err.message || "Could not reopen that session."
            : "Could not reach the backend. Make sure the FastAPI server is running.",
      });
    } finally {
      setSending(false);
    }
  }

  function applyFinalResult(response: SupervisorResponse, assistantId: string) {
    if (response.agent === "sales_analysis") {
      const analysis = response.result.response as AnalyzeResponse;
      setResult(analysis);
      setActiveCompanyId(String(analysis.company_id));
      const assessment = analysis.overall_assessment;
      const replyContent =
        assessment?.overall_recommendation ||
        "Analysis complete — see the executive brief for the full breakdown.";

      patchMessage(assistantId, {
        kind: "report",
        content: replyContent,
        steps: undefined,
        chips: undefined,
        report: reportFromAnalysis(analysis),
      });
    } else {
      // Research agent — don't touch the executive brief panel, this
      // wasn't a company analysis.
      const researchResponse = response.result.response as { content?: string };
      const replyContent =
        researchResponse?.content ||
        (typeof response.result.response === "string" ? response.result.response : null) ||
        "Here's what I found.";

      patchMessage(assistantId, {
        kind: "text",
        content: replyContent,
        steps: undefined,
        chips: undefined,
      });
    }
  }

  async function handleSend(
    text: string,
    meta: { mode: WorkspaceMode; attachments: ComposerAttachment[] },
  ) {
    const userMessage: ChatMessage = {
      id: `m-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date().toISOString(),
      attachments: meta.attachments.map((a) => a.label),
    };
    const assistantId = `m-${Date.now() + 1}`;
    const assistantMessage: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      kind: "loading",
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setSending(true);

    // Resource chips for whatever was actually attached — known upfront,
    // unlike the agent steps below which arrive live as the real backend
    // pipeline (Planner -> Router -> Research/Sales-Analysis agents) runs.
    const chips: string[] = meta.attachments.map((a) => CHIP_BY_KIND[a.kind]).filter(Boolean);
    const steps: WorkspaceStreamStep[] = [];
    let streaming = false;

    function upsertStep(evt: { id: string; label: string; status: WorkspaceStreamStep["status"]; agent?: string }) {
      const idx = steps.findIndex((s) => s.id === evt.id);
      const nextStep: WorkspaceStreamStep = { id: evt.id, label: evt.label, status: evt.status, agent: evt.agent };
      if (idx === -1) steps.push(nextStep);
      else steps[idx] = nextStep;

      if (evt.agent && !chips.includes(evt.agent)) chips.push(evt.agent);

      if (!streaming) {
        streaming = true;
        patchMessage(assistantId, { kind: "stream", steps: [...steps], chips: [...chips] });
      } else {
        patchMessage(assistantId, { steps: [...steps], chips: [...chips] });
      }
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await workspaceService.streamSupervisor(
        text,
        (frame: StreamFrame) => {
          if (frame.type === "step") {
            upsertStep(frame.data);
          } else if (frame.type === "final") {
            applyFinalResult(frame.data, assistantId);
          } else if (frame.type === "error") {
            patchMessage(assistantId, {
              kind: "text",
              content: `The pipeline returned an error: ${frame.data.message}`,
              steps: undefined,
              chips: undefined,
            });
          }
        },
        controller.signal,
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `The pipeline returned an error: ${err.message}`
          : "Could not reach the backend. Make sure the FastAPI server is running.";

      patchMessage(assistantId, {
        kind: "text",
        content: message,
        steps: undefined,
        chips: undefined,
      });
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-5 lg:grid-cols-[240px_1fr_300px]">
      <div className="hidden lg:block">
        <HistorySidebar onSelectCompany={handleSelectCompany} activeCompanyId={activeCompanyId} />
      </div>

      <div className="min-h-0">
        <ChatPanel messages={messages} onSend={handleSend} sending={sending} />
      </div>

      <div className="hidden overflow-y-auto pr-1 lg:block">
        <ExecutiveBriefPanel assessment={result?.overall_assessment ?? null} knowledge={result?.knowledge ?? null} />
      </div>
    </div>
  );
}