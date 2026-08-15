# ProspectIQ — AI Decision Intelligence Platform for Enterprise Sales
![alt text](image.png)
ProspectIQ turns scattered company research into an evidence-backed, human-approved
outreach plan. A supervised multi-agent pipeline ingests whatever you give it — a
company brief, notes, a website — extracts structured knowledge, builds a buyer
persona, scores intent, drafts a sales strategy, and then runs that strategy back
through a **Guardrail agent** that checks every claim against the source evidence
before anything is allowed to reach a prospect's inbox.

> **Autonomous Account-Based Marketing Strategy & Outreach Orchestrator** —
> NexBuildOn Hack 2026, Domain 4: Agentic AI — Team Decoders

---

## What it actually does

1. **Research → Knowledge** — free-form text, notes, or a URL go into a
   knowledge-extraction agent that pulls out company facts, decision-makers,
   pain points, and buying signals.
2. **Persona & Intent** — dedicated agents build a buyer persona and score
   purchase intent / buying stage from that knowledge.
3. **Strategy** — a strategy agent turns persona + intent into a recommended
   next action and messaging angle.
4. **Guardrail** — every claim in the strategy is checked against the
   underlying evidence. Unsupported claims get flagged, a risk level is
   assigned, and unverified strategies are **blocked from outreach** until a
   human reviews them.
5. **Human-approved outreach** — approved strategies can be turned into an
   outreach draft (email/LinkedIn/call script), edited, approved, and sent —
   currently wired through Gmail — with every step recorded in a queryable
   **audit trail**.

A Supervisor/Router layer sits in front of the pipeline: free-form chat in the
Workspace is planned and routed to either the sales-analysis pipeline (for
company briefs) or a general research agent (for everything else), streaming
live step-by-step progress back to the UI over SSE.

---

## Architecture

```
                              ┌─────────────────────┐
   User (Workspace chat) ───▶│  Supervisor / Router │
                              └──────────┬───────────┘
                                         │
                     ┌───────────────────┼────────────────────┐
                     ▼                                        ▼
          ┌─────────────────────┐                 ┌───────────────────┐
          │  Sales Analysis      │                 │   Research Agent   │
          │  Pipeline             │                 │  (general Q&A /    │
          │                       │                 │   web lookups)     │
          │  Knowledge Ingestion  │                 └───────────────────┘
          │        │              │
          │        ▼              │
          │  Persona Agent        │
          │        │              │
          │        ▼              │
          │  Intent Agent         │
          │        │              │
          │        ▼              │
          │  Strategy Agent       │
          │        │              │
          │        ▼              │
          │  Guardrail Agent ─────┼──▶ approved? ──▶ Outreach Queue ──▶ Gmail
          │  (evidence check,     │        │
          │   risk scoring)       │        ▼
          └───────────────────────┘   blocked ──▶ human review required
                     │
                     ▼
              Audit Trail (Postgres)
```

Each agent is a focused class that makes its own LLM call, parses a structured
JSON response (with safe fallbacks if parsing fails), and persists its output
to Postgres against the company/analysis record — so every screen in the
frontend (Executive Brief, Audit Trail, Accounts) reads from the same
real analysis history instead of a separate mock layer.

---

## Tech stack

**Backend**
- FastAPI + SQLAlchemy + PostgreSQL
- JWT authentication
- Multi-LLM router with adapters for Groq, Gemini, OpenRouter, and self-hosted
  models (vLLM/Ollama) — no single-provider lock-in
- Server-Sent Events (`/executor/stream`) for live agent progress in the UI
- Gmail integration for sending approved outreach drafts

**Frontend**
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS + Radix-based UI primitives
- Framer Motion, React Flow (Relationship Graph), Recharts (Accounts
  dashboards), cmdk (⌘K command palette)

---

## Project structure

```
backend/
  app/
    agents/            knowledge_ingestion, persona, intent, strategy, guardrail,
                        research_agent, research_v2, sales_analysis_agent
    api/                auth, knowledge, persona, intent, strategy, guardrail,
                        assistant, analysis, workspace, queue, audit, supervisor,
                        executor, planner, router, memory, llm, tools, upload, website
    models/             User, Company, AnalysisResult, OutreachDraft, ConnectedAccount, ...
    pipeline/           prospect_pipeline.py — chains the five core agents
    supervisor/         plans + routes free-form prompts to the right agent
    main.py
  requirements.txt

Frontend/
  app/
    (app)/              authenticated shell: workspace, accounts, accounts/[id],
                         graph, recommendations, queue, audit, profile
    login/ signup/ forgot-password/
  components/
    workspace/           chat panel, executive brief, guardrail verdict, prompt composer
    accounts/ audit/ queue/ graph/ layout/ ui/
  services/               api-client + one service per domain (workspace, accounts,
                           queue, auth) — all real fetch calls, no mock layer
  lib/ hooks/ types/
```

---

## Running it locally

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Set your database URL and LLM provider API key(s) in `.env` before starting —
see `app/core/config.py` for the expected variables.

### Frontend

```bash
cd Frontend
npm install
npm run dev
```

Open http://localhost:3000. Copy `.env.example` to `.env.local` and point
`NEXT_PUBLIC_API_URL` at your running backend.

---

## Current status

**Built and working:** knowledge extraction → persona → intent → strategy →
guardrail pipeline; Supervisor/Router with live SSE streaming; Guardrail
evidence checking with risk scoring and outreach blocking; Outreach Queue with
approve/edit/send via Gmail; Audit Trail backed by real analysis history;
Workspace chat, Accounts dashboard, Relationship Graph, Recommendation Center.

**In progress:** a dedicated autonomous web-research step (`research_v2`) is
built but not yet wired into the main pipeline — today the pipeline runs on
whatever text/notes are given to it rather than agent-driven web research.
Meeting scheduling (best-time suggestions, calendar slots) is partially wired
on the frontend ahead of the corresponding backend endpoints.

**Not yet built:** HubSpot/CRM integrations, WhatsApp/Twilio outreach
channels, and the Kubernetes/Temporal/Kafka production-scale infrastructure
described in the pitch deck — the current prototype runs as a single FastAPI
service + Next.js app.

---

## Team

Nikita Mishra · Ranjit Bhardwaj · Gaurav Chauhan · Shreyash Bhagwat

## License

Developed for NexBuildOn Hack 2026. All rights reserved © 2026.