"use client";

interface Props {
  agent: string;
  analysis?: any;
  event?: any;
}

export default function AuditAgentRenderer({
  agent,
  analysis,
  event,
}: Props) {
  // Research Agent
  if (agent === "Research Agent") {
    return (
      <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <div className="grid grid-cols-2 gap-3">
          <Info title="Status" value="Completed" />
          <Info title="Duration" value={event?.time} />
          <Info title="Search" value="Completed" />
          <Info title="Website Crawl" value="Completed" />
          <Info title="Knowledge Extraction" value="Completed" />
          <Info title="Output" value="Passed to Knowledge Agent" />
        </div>
      </div>
    );
  }

  // Knowledge Agent / Ingestion
  if (agent === "Knowledge Ingestion") {
    return (
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <Info
          title="Company"
          value={
            analysis?.knowledge?.company ??
            analysis?.knowledge?.knowledge?.company ??
            "-"
          }
        />

        <Info
          title="Website"
          value={
            analysis?.knowledge?.website ??
            analysis?.knowledge?.knowledge?.website ??
            "-"
          }
        />

        <Info
          title="Industry"
          value={
            analysis?.knowledge?.industry ??
            analysis?.knowledge?.knowledge?.industry ??
            "-"
          }
        />

        <Info
          title="Knowledge Saved"
          value={analysis?.execution?.knowledge_saved ? "YES" : "NO"}
        />
      </div>
    );
  }

  // Knowledge Repository
  if (agent === "Knowledge Repository") {
    return (
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <Info
          title="Repository Status"
          value={analysis?.execution?.knowledge_saved ? "Saved" : "Not Saved"}
        />

        <Info
          title="Knowledge ID"
          value={analysis?.knowledge_id}
        />

        <Info
          title="Company"
          value={
            analysis?.knowledge?.company ??
            analysis?.knowledge?.knowledge?.company ??
            "-"
          }
        />

        <Info
          title="Source"
          value={
            analysis?.knowledge?.source_name ??
            "-"
          }
        />

        <Info
          title="Source Type"
          value={
            analysis?.knowledge?.source_type ??
            "-"
          }
        />

        <Info
          title="Created At"
          value={
            analysis?.created_at
              ? new Date(analysis.created_at).toLocaleString()
              : "-"
          }
        />
      </div>
    );
  }

  // Persona
  if (agent === "Persona Agent") {
    return (
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <Info
          title="Buyer Persona"
          value={analysis?.persona?.buyer_persona}
        />

        <Info
          title="Decision Level"
          value={analysis?.persona?.decision_level}
        />

        <Info
          title="Primary Decision Maker"
          value={analysis?.persona?.primary_decision_maker}
        />

        <Info
          title="Communication Style"
          value={analysis?.persona?.communication_style}
        />
      </div>
    );
  }

  // Intent
  if (agent === "Intent Agent") {
    return (
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <Info title="Intent Score" value={analysis?.intent?.intent_score} />

        <Info title="Buying Stage" value={analysis?.intent?.buying_stage} />

        <Info title="Priority" value={analysis?.intent?.priority} />

        <Info title="Confidence" value={analysis?.intent?.confidence} />
      </div>
    );
  }

  // Strategy
  if (agent === "Strategy Agent") {
    return (
      <div className="mt-4 space-y-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <Info
          title="Next Best Action"
          value={analysis?.strategy?.next_best_action}
        />

        <Info
          title="Email Subject"
          value={analysis?.strategy?.email_subject}
        />

        <Info
          title="LinkedIn Message"
          value={analysis?.strategy?.linkedin_message}
        />

        <Info
          title="Confidence"
          value={analysis?.strategy?.confidence}
        />
      </div>
    );
  }

  // Guardrail
  if (agent === "Guardrail Agent") {
    return (
      <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-white/10 bg-white/[0.02] p-4">
        <Info
          title="Approved"
          value={analysis?.guardrail?.approved ? "YES" : "NO"}
        />

        <Info
          title="Risk Level"
          value={analysis?.guardrail?.risk_level}
        />

        <Info
          title="Confidence"
          value={analysis?.guardrail?.confidence}
        />

        <Info
          title="Recommendation"
          value={analysis?.guardrail?.recommendation}
        />
      </div>
    );
  }

  return null;
}

function Info({
  title,
  value,
}: {
  title: string;
  value: any;
}) {
  return (
    <div className="rounded-lg bg-white/[0.03] p-3">
      <p className="text-xs text-white/40">{title}</p>
      <p className="mt-1 text-sm font-medium">{value ?? "-"}</p>
    </div>
  );
}