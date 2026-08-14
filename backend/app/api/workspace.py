from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.auth.dependencies import get_current_user
from app.database.session import get_db
from app.models.analysis_result import AnalysisResult
from app.models.company import Company
from app.models.user import User
from statistics import mean
from app.models.knowledge_source import KnowledgeSource
import re

router = APIRouter(
    prefix="/workspace",
    tags=["Workspace"],
)


@router.get("/")
async def workspace(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    companies = (
        db.query(Company)
        .join(AnalysisResult)
        .filter(
            AnalysisResult.user_id == current_user.id
        )
        .group_by(Company.id)
        .all()
    )

    # Single bulk query instead of one query per company (N+1) — this is
    # what was making the page take 10-15s with more than a handful of
    # accounts, since each extra query is a full network round trip to
    # the database.
    all_analyses = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.user_id == current_user.id)
        .order_by(AnalysisResult.created_at.asc())
        .all()
    )

    analyses_by_company: dict[int, list[AnalysisResult]] = defaultdict(list)
    for analysis in all_analyses:
        analyses_by_company[analysis.company_id].append(analysis)

    response = []

    for company in companies:

        analyses = analyses_by_company.get(company.id, [])

        if not analyses:
            continue

        total = len(analyses)

        # analyses_by_company lists are already sorted ascending by
        # created_at (from the query above), so the last one is latest.
        latest = analyses[-1]

        response.append(
            {
                "company_id": company.id,
                "company": company.name,
                "website": company.website,
                "industry": company.industry,
                "total_analyses": total,
                "last_analysis": latest.created_at,
                "latest_intent": latest.intent.get(
                    "intent_score",
                    0,
                ),
                "priority": latest.intent.get(
                    "priority",
                    "",
                ),
            }
        )

    return response
@router.get("/stats")
async def workspace_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Aggregate real numbers for the Accounts dashboard: the four stat
    cards (total accounts, avg trust score, guardrail catches,
    stakeholders mapped) and the four charts (research status donut,
    pain points by industry, research activity over time, trust score
    distribution). Everything here is derived from this user's actual
    companies/analyses/knowledge — nothing hardcoded.
    """

    companies = (
        db.query(Company)
        .join(AnalysisResult)
        .filter(AnalysisResult.user_id == current_user.id)
        .distinct()
        .all()
    )

    all_analyses = (
        db.query(AnalysisResult)
        .filter(AnalysisResult.user_id == current_user.id)
        .order_by(AnalysisResult.created_at.asc())
        .all()
    )

    now = datetime.utcnow()
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    # Latest + first analysis per company (analyses are sorted ascending,
    # so the last write for a company_id in the loop is always its latest).
    latest_by_company: dict[int, AnalysisResult] = {}
    first_created_by_company: dict[int, datetime] = {}

    for analysis in all_analyses:
        latest_by_company[analysis.company_id] = analysis
        first_created_by_company.setdefault(analysis.company_id, analysis.created_at)

    # ---- Stat cards ----
    total_accounts = len(companies)
    new_accounts_this_week = sum(
        1 for created in first_created_by_company.values() if created >= week_ago
    )

    trust_scores = [
        latest_by_company[c.id].intent.get("intent_score", 0) or 0
        for c in companies
        if c.id in latest_by_company
    ]
    avg_trust_score = round(mean(trust_scores)) if trust_scores else 0

    recent_scores = [
        a.intent.get("intent_score", 0) or 0
        for a in all_analyses
        if a.created_at >= week_ago
    ]
    prior_scores = [
        a.intent.get("intent_score", 0) or 0
        for a in all_analyses
        if two_weeks_ago <= a.created_at < week_ago
    ]
    trust_score_delta = (
        round(mean(recent_scores) - mean(prior_scores), 1)
        if recent_scores and prior_scores
        else None
    )

    guardrail_catches = sum(
        1 for a in all_analyses if not a.guardrail.get("approved", True)
    )
    guardrail_catches_this_week = sum(
        1
        for a in all_analyses
        if not a.guardrail.get("approved", True) and a.created_at >= week_ago
    )

    # ---- Per-company breakdown for the charts (status, pain points,
    # trust buckets) — pulls each company's latest extracted knowledge. ----
    status_counts = {"analyzed": 0, "in-review": 0, "queued": 0}
    industry_pain_counts: dict[str, int] = defaultdict(int)
    trust_buckets = {"0-20": 0, "21-40": 0, "41-60": 0, "61-80": 0, "81-100": 0}
    stakeholders_mapped = 0

    # Single bulk query for every knowledge source we'll need, instead of
    # one query per company (N+1) — this was the main cause of the slow
    # page load, since each extra query is a full DB round trip.
    needed_knowledge_ids = {
        latest_by_company[c.id].knowledge_id
        for c in companies
        if c.id in latest_by_company
    }
    knowledge_by_id: dict[int, dict] = {}
    if needed_knowledge_ids:
        knowledge_sources = (
            db.query(KnowledgeSource)
            .filter(KnowledgeSource.id.in_(needed_knowledge_ids))
            .all()
        )
        knowledge_by_id = {
            ks.id: (ks.processed_data.get("knowledge", {}) or {}) for ks in knowledge_sources
        }

    for company in companies:
        latest = latest_by_company.get(company.id)

        if latest is None:
            status_counts["queued"] += 1
            continue

        status_counts["analyzed" if latest.guardrail.get("approved", True) else "in-review"] += 1

        score = latest.intent.get("intent_score", 0) or 0
        if score <= 20:
            bucket_label = "0-20"
        elif score <= 40:
            bucket_label = "21-40"
        elif score <= 60:
            bucket_label = "41-60"
        elif score <= 80:
            bucket_label = "61-80"
        else:
            bucket_label = "81-100"
        trust_buckets[bucket_label] += 1

        knowledge = knowledge_by_id.get(latest.knowledge_id, {})

        pain_points = knowledge.get("pain_points", []) or []
        industry = company.industry or "Unknown"
        industry_pain_counts[industry] += len(pain_points)

        contacts = knowledge.get("contacts", []) or []
        if not contacts:
            contacts = knowledge.get("decision_makers", []) or []
        stakeholders_mapped += len(contacts)

    # ---- Research activity: analyses per day over the last 14 days ----
    activity_by_day: dict[str, int] = defaultdict(int)
    for analysis in all_analyses:
        activity_by_day[analysis.created_at.date().isoformat()] += 1

    last_14_days = [(now - timedelta(days=i)).date().isoformat() for i in range(13, -1, -1)]
    research_activity = [
        {"date": day, "analyses": activity_by_day.get(day, 0)} for day in last_14_days
    ]

    top_industries = sorted(
        industry_pain_counts.items(), key=lambda kv: kv[1], reverse=True
    )[:6]

    return {
        "total_accounts": total_accounts,
        "new_accounts_this_week": new_accounts_this_week,
        "avg_trust_score": avg_trust_score,
        "trust_score_delta": trust_score_delta,
        "guardrail_catches": guardrail_catches,
        "guardrail_catches_this_week": guardrail_catches_this_week,
        "stakeholders_mapped": stakeholders_mapped,
        "research_status": [
            {"status": status, "count": count} for status, count in status_counts.items()
        ],
        "pain_points_by_industry": [
            {"industry": industry, "count": count} for industry, count in top_industries
        ],
        "research_activity": research_activity,
        "trust_distribution": [
            {"bucket": bucket, "count": count} for bucket, count in trust_buckets.items()
        ],
    }

@router.get("/company/{company_id}")
async def company_details(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    company = (
        db.query(Company)
        .filter(
            Company.id == company_id
        )
        .first()
    )

    if company is None:
        return {
            "error": "Company not found"
        }

    analyses = (
        db.query(AnalysisResult)
        .filter(
            AnalysisResult.company_id == company_id,
            AnalysisResult.user_id == current_user.id,
        )
        .order_by(
            AnalysisResult.created_at.desc()
        )
        .all()
    )

    response = []

    for analysis in analyses:

        response.append(
            {
                "analysis_id": analysis.id,
                "intent_score": analysis.intent.get(
                    "intent_score",
                    0,
                ),
                "priority": analysis.intent.get(
                    "priority",
                    "",
                ),
                "buying_stage": analysis.intent.get(
                    "buying_stage",
                    "",
                ),
                "decision_maker": analysis.persona.get(
                    "primary_decision_maker",
                    "",
                ),
                "created_at": analysis.created_at,
            }
        )

    return {
        "company": {
            "id": company.id,
            "name": company.name,
            "website": company.website,
            "industry": company.industry,
        },
        "analyses": response,
    }


@router.get("/search")
async def search_workspace(
    q: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    analyses = (
        db.query(AnalysisResult)
        .filter(
            AnalysisResult.user_id == current_user.id
        )
        .all()
    )

    q = q.lower()

    results = []

    for analysis in analyses:

        company = analysis.company

        searchable = [
            company.name if company else "",
            analysis.persona.get(
                "primary_decision_maker",
                "",
            ),
            str(
                analysis.strategy.get(
                    "account_summary",
                    "",
                )
            ),
            str(
                analysis.intent.get(
                    "reasoning",
                    "",
                )
            ),
        ]

        text = " ".join(searchable).lower()

        if q in text:

            results.append(
                {
                    "analysis_id": analysis.id,
                    "company": company.name if company else "",
                    "decision_maker": analysis.persona.get(
                        "primary_decision_maker",
                        "",
                    ),
                    "intent_score": analysis.intent.get(
                        "intent_score",
                        0,
                    ),
                    "priority": analysis.intent.get(
                        "priority",
                        "",
                    ),
                }
            )

    return results

@router.get("/filter")
async def filter_workspace(
    priority: str | None = None,
    stage: str | None = None,
    intent_min: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    analyses = (
        db.query(AnalysisResult)
        .filter(
            AnalysisResult.user_id == current_user.id
        )
        .all()
    )

    response = []

    for analysis in analyses:

        if priority:

            if (
                analysis.intent.get(
                    "priority",
                    ""
                ).lower()
                != priority.lower()
            ):
                continue

        if stage:

            if (
                analysis.intent.get(
                    "buying_stage",
                    ""
                ).lower()
                != stage.lower()
            ):
                continue

        if intent_min:

            if (
                analysis.intent.get(
                    "intent_score",
                    0
                )
                < intent_min
            ):
                continue

        response.append(
            {
                "analysis_id": analysis.id,
                "company": analysis.company.name,
                "intent_score": analysis.intent.get(
                    "intent_score",
                    0,
                ),
                "priority": analysis.intent.get(
                    "priority",
                    "",
                ),
                "buying_stage": analysis.intent.get(
                    "buying_stage",
                    "",
                ),
            }
        )

    return response


@router.get("/company/{company_id}/dashboard")
async def company_dashboard(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    company = (
        db.query(Company)
        .filter(
            Company.id == company_id
        )
        .first()
    )

    if company is None:
        return {
            "error": "Company not found"
        }

    analyses = (
        db.query(AnalysisResult)
        .filter(
            AnalysisResult.company_id == company_id,
            AnalysisResult.user_id == current_user.id,
        )
        .order_by(
            AnalysisResult.created_at.desc()
        )
        .all()
    )

    if not analyses:
        return {
            "error": "No analyses found"
        }

    latest = analyses[0]

    intent_scores = [
        a.intent.get("intent_score", 0)
        for a in analyses
    ]

    average_intent = round(
        mean(intent_scores),
        2,
    )

    latest_intent = latest.intent

    latest_persona = latest.persona

    latest_strategy = latest.strategy

    latest_guardrail = latest.guardrail

    dashboard = {

        "company": {

            "id": company.id,

            "name": company.name,

            "website": company.website,

            "industry": company.industry,
        },

        "summary": latest_strategy.get(
            "account_summary",
            "",
        ),

        "health_score": average_intent,

        "latest_intent_score": latest_intent.get(
            "intent_score",
            0,
        ),

        "priority": latest_intent.get(
            "priority",
            "",
        ),

        "buying_stage": latest_intent.get(
            "buying_stage",
            "",
        ),

        "risk_level": latest_guardrail.get(
            "risk_level",
            "",
        ),

        "decision_maker": latest_persona.get(
            "primary_decision_maker",
            "",
        ),

        "recommended_action": latest_strategy.get(
            "next_best_action",
            "",
        ),

        "communication_style": latest_persona.get(
            "communication_style",
            "",
        ),

        "confidence": latest_guardrail.get(
            "confidence",
            0,
        ),

        "analyses_count": len(
            analyses
        ),

        "latest_analysis": {

            "analysis_id": latest.id,

            "created_at": latest.created_at,
        }
    }

    return dashboard

@router.get("/recommendations")
async def recommendations(
    company_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    query = db.query(AnalysisResult).filter(
        AnalysisResult.user_id == current_user.id
    )

    if company_id is not None:
        query = query.filter(AnalysisResult.company_id == company_id)

    analyses = query.order_by(AnalysisResult.created_at.asc()).all()

    # One recommendation per company, built from that company's most
    # recent analysis (analyses are sorted ascending above, so the last
    # write per company_id in this loop is always the latest one) —
    # mirrors the "current state of the account" convention used by
    # company_dashboard() and workspace_stats() elsewhere in this file,
    # instead of surfacing every historical analysis as a separate card.
    latest_by_company: dict[int, AnalysisResult] = {}
    for analysis in analyses:
        latest_by_company[analysis.company_id] = analysis

    recommendations = []

    for analysis in latest_by_company.values():

        company = analysis.company

        if company is None:
            continue

        score = 0

        reasons = []

        intent = analysis.intent.get(
            "intent_score",
            0,
        )

        score += intent

        if analysis.intent.get("priority") == "High":
            score += 10
            reasons.append("High priority account")

        if analysis.persona.get(
            "primary_decision_maker",
            ""
        ):
            score += 5
            reasons.append("Decision maker identified")

        if analysis.guardrail.get(
            "risk_level",
            ""
        ).lower() == "low":
            score += 5
            reasons.append("Low execution risk")

        if analysis.strategy.get(
            "next_best_action",
            ""
        ):
            score += 5
            reasons.append("Clear next action available")

        recommendations.append(
            {
                "analysis_id": analysis.id,
                "company_id": company.id,
                "company": company.name,
                "website": company.website,
                "industry": company.industry,
                "score": min(score, 100),
                "priority": analysis.intent.get(
                    "priority",
                    "",
                ),
                "intent": intent,
                "buying_stage": analysis.intent.get(
                    "buying_stage",
                    "",
                ),
                "risk_level": analysis.guardrail.get(
                    "risk_level",
                    "",
                ),
                "decision_maker": analysis.persona.get(
                    "primary_decision_maker",
                    "",
                ),
                "confidence": analysis.guardrail.get(
                    "confidence",
                    0,
                ),
                "next_action": analysis.strategy.get(
                    "next_best_action",
                    "",
                ),
                "reason": reasons,
                "created_at": analysis.created_at,
            }
        )

    recommendations.sort(
        key=lambda x: x["score"],
        reverse=True,
    )

    return {
        "recommended_companies": recommendations
    }


@router.get("/company/{company_id}/trend")
async def company_trend(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    analyses = (
        db.query(AnalysisResult)
        .filter(
            AnalysisResult.company_id == company_id,
            AnalysisResult.user_id == current_user.id,
        )
        .order_by(
            AnalysisResult.created_at.asc()
        )
        .all()
    )

    if not analyses:
        return {
            "error": "No analyses found"
        }

    history = []

    priorities = []

    stages = []

    for analysis in analyses:

        history.append(
            {
                "analysis_id": analysis.id,
                "date": analysis.created_at,
                "intent_score": analysis.intent.get(
                    "intent_score",
                    0,
                ),
            }
        )

        priorities.append(
            analysis.intent.get(
                "priority",
                "",
            )
        )

        stages.append(
            analysis.intent.get(
                "buying_stage",
                "",
            )
        )

    scores = [
        x["intent_score"]
        for x in history
    ]

    current = scores[-1]

    previous = scores[-2] if len(scores) > 1 else current

    change = current - previous

    if change > 5:
        trend = "Increasing"

    elif change < -5:
        trend = "Decreasing"

    else:
        trend = "Stable"

    if current >= 80:

        recommendation = "Contact immediately"

    elif current >= 60:

        recommendation = "Continue nurturing"

    else:

        recommendation = "Monitor account"

    return {

        "company_id": company_id,

        "trend": trend,

        "current_intent": current,

        "previous_intent": previous,

        "change": change,

        "recommendation": recommendation,

        "history": history,

        "priority_history": priorities,

        "buying_stage_history": stages,

    }

@router.get("/company/{company_id}/activity")
async def company_activity(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):

    analyses = (
        db.query(AnalysisResult)
        .filter(
            AnalysisResult.company_id == company_id,
            AnalysisResult.user_id == current_user.id,
        )
        .order_by(
            AnalysisResult.created_at.asc()
        )
        .all()
    )

    if not analyses:
        return {
            "error": "No activity found"
        }

    timeline = []

    for analysis in analyses:

        created = analysis.created_at

        knowledge = (
            db.query(KnowledgeSource)
            .filter(
                KnowledgeSource.id == analysis.knowledge_id
            )
            .first()
        )

        if knowledge:

            company = knowledge.processed_data.get(
                "knowledge",
                {}
            ).get(
                "company",
                ""
            )

            timeline.append({
                "time": created,
                "type": "Knowledge",
                "icon": "📄",
                "title": "Knowledge Extracted",
                "description": f"Company identified as {company}"
            })

        decision = analysis.persona.get(
            "primary_decision_maker",
            ""
        )

        if decision:

            timeline.append({
                "time": created,
                "type": "Persona",
                "icon": "👤",
                "title": "Decision Maker Identified",
                "description": decision
            })

        timeline.append({
            "time": created,
            "type": "Intent",
            "icon": "📈",
            "title": "Buying Intent",
            "description": f'Intent Score: {analysis.intent.get("intent_score",0)}'
        })

        timeline.append({
            "time": created,
            "type": "Strategy",
            "icon": "🎯",
            "title": "Next Best Action",
            "description": analysis.strategy.get(
                "next_best_action",
                ""
            )
        })

        timeline.append({
            "time": created,
            "type": "Guardrail",
            "icon": "🛡️",
            "title": "Risk Assessment",
            "description": analysis.guardrail.get(
                "risk_level",
                ""
            )
        })

    timeline.sort(
        key=lambda x: x["time"]
    )

    return {
        "company_id": company_id,
        "company": analyses[0].company.name,
        "total_events": len(timeline),
        "timeline": timeline,
    }


# =========================================================
# Stakeholders / Pain Points / Buying Signals / Graph
#
# These derive from the raw extracted knowledge (contacts,
# decision_makers, pain_points, buying_signals) attached to a company's
# most recent analysis, rather than a separate table — the knowledge
# extraction agent already produces this data, it just wasn't exposed
# yet.
# =========================================================


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug or "unknown"

def _to_text(value) -> str:
    """
    Coerce whatever the LLM/persona agent actually returned into a plain
    string. `primary_decision_maker` (and similar persona/knowledge
    fields) are documented as strings, but the underlying LLM
    occasionally returns a structured object instead (e.g.
    {"name": "Sarah Chen", "title": "CTO"}) — without this, calling
    .strip()/.lower() on that dict crashes the whole endpoint with a
    500. This normalizes any shape (dict, list, None, str) down to text
    instead of trusting the LLM's output format.
    """
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        for key in ("name", "primary_decision_maker", "decision_maker", "title"):
            candidate = value.get(key)
            if isinstance(candidate, str) and candidate:
                return candidate
        return " ".join(str(v) for v in value.values() if isinstance(v, str)) or ""
    if isinstance(value, (list, tuple)):
        return ", ".join(_to_text(v) for v in value if v)
    return str(value)


def _latest_knowledge_for_company(
    db: Session,
    company_id: int,
    user_id: int,
):
    latest_analysis = (
        db.query(AnalysisResult)
        .filter(
            AnalysisResult.company_id == company_id,
            AnalysisResult.user_id == user_id,
        )
        .order_by(AnalysisResult.created_at.desc())
        .first()
    )

    if latest_analysis is None:
        return None, None

    knowledge_source = (
        db.query(KnowledgeSource)
        .filter(KnowledgeSource.id == latest_analysis.knowledge_id)
        .first()
    )

    if knowledge_source is None:
        return latest_analysis, None

    return latest_analysis, knowledge_source.processed_data.get("knowledge", {})


def _infer_influence(name, role, primary_decision_maker) -> str:
    name = _to_text(name)
    role = _to_text(role)
    primary_decision_maker = _to_text(primary_decision_maker)

    role_lower = role.lower()

    if name and primary_decision_maker and name.strip().lower() == primary_decision_maker.strip().lower():
        return "Decision Maker"

    if any(k in role_lower for k in ["cfo", "finance", "budget", "procurement"]):
        return "Budget Holder"

    if any(k in role_lower for k in ["security", "compliance", "legal", "risk"]):
        return "Blocker"

    if any(k in role_lower for k in ["vp", "head", "director", "lead"]):
        return "Champion"

    return "Influencer"


@router.get("/company/{company_id}/stakeholders")
async def company_stakeholders(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analysis, knowledge = _latest_knowledge_for_company(db, company_id, current_user.id)

    if analysis is None:
        return []

    knowledge = knowledge or {}
    persona = analysis.persona or {}
    primary_decision_maker = _to_text(persona.get("primary_decision_maker", ""))

    contacts = knowledge.get("contacts", []) or []
    pain_points = knowledge.get("pain_points", []) or []
    buying_signals = knowledge.get("buying_signals", []) or []
    confidence = knowledge.get("confidence", 0) or 0

    # Fall back to the plain decision_makers list if no structured
    # contacts were extracted, so the screen isn't empty just because
    # the source text didn't include emails/phone numbers.
    if not contacts:
        contacts = [
            {"name": _to_text(name), "role": "", "email": "", "phone": ""}
            for name in (knowledge.get("decision_makers", []) or [])
        ]

    stakeholders = []

    for contact in contacts:
        name = _to_text(contact.get("name", "")) or "Unknown"
        role = _to_text(contact.get("role", ""))

        stakeholders.append(
            {
                "id": _slugify(f"{company_id}-{name}"),
                "name": name,
                "title": role or "Unknown role",
                "dept": role.split(" ")[0] if role else "General",
                "influence": _infer_influence(name, role, primary_decision_maker),
                "score": confidence,
                "linkedin": False,
                "email": contact.get("email", "") or "",
                "companyId": str(company_id),
                "evidence": knowledge.get("sources", []) or [],
                "painPoints": pain_points,
                "buyingSignals": buying_signals,
            }
        )

    return stakeholders


@router.get("/company/{company_id}/pain-points")
async def company_pain_points(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analysis, knowledge = _latest_knowledge_for_company(db, company_id, current_user.id)

    if analysis is None:
        return []

    knowledge = knowledge or {}
    points = knowledge.get("pain_points", []) or []
    confidence = knowledge.get("confidence", 0) or 0
    source_count = max(len(knowledge.get("sources", []) or []), 1)

    result = []

    for i, point in enumerate(points):
        severity = "critical" if i == 0 else "high" if i == 1 else "medium"

        result.append(
            {
                "id": _slugify(f"{company_id}-pain-{i}-{point}"),
                "title": point if len(point) <= 80 else point[:77] + "...",
                "severity": severity,
                "confidence": confidence,
                "sources": source_count,
                "excerpt": point,
                "companyId": str(company_id),
            }
        )

    return result


@router.get("/company/{company_id}/buying-signals")
async def company_buying_signals(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analysis, knowledge = _latest_knowledge_for_company(db, company_id, current_user.id)

    if analysis is None:
        return []

    knowledge = knowledge or {}
    signals = knowledge.get("buying_signals", []) or []

    result = []

    for i, signal in enumerate(signals):
        result.append(
            {
                "id": _slugify(f"{company_id}-signal-{i}-{signal}"),
                "title": signal,
                "strength": "strong" if i == 0 else "moderate",
                "detectedAt": analysis.created_at.date().isoformat(),
                "source": "Extracted from ingested notes",
            }
        )

    return result


@router.get("/company/{company_id}/graph")
async def company_graph(
    company_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    analysis, knowledge = _latest_knowledge_for_company(db, company_id, current_user.id)

    if analysis is None:
        return {"nodes": [], "edges": []}

    knowledge = knowledge or {}
    persona = analysis.persona or {}
    primary_decision_maker = _to_text(persona.get("primary_decision_maker", ""))

    contacts = knowledge.get("contacts", []) or []
    if not contacts:
        contacts = [
            {"name": _to_text(name), "role": ""}
            for name in (knowledge.get("decision_makers", []) or [])
        ]

    pain_points = knowledge.get("pain_points", []) or []
    buying_signals = knowledge.get("buying_signals", []) or []
    confidence = knowledge.get("confidence", 0) or 0

    nodes = []
    decision_maker_id = None

    for contact in contacts:
        name = _to_text(contact.get("name", "")) or "Unknown"
        role = _to_text(contact.get("role", ""))
        node_id = _slugify(f"{company_id}-{name}")
        influence = _infer_influence(name, role, primary_decision_maker)

        if influence == "Decision Maker":
            decision_maker_id = node_id

        nodes.append(
            {
                "id": node_id,
                "name": name,
                "title": role or "Unknown role",
                "influence": influence,
                "confidence": confidence,
                "evidence": knowledge.get("sources", []) or [],
                "painPoints": pain_points,
                "buyingSignals": buying_signals,
            }
        )

    edges = []

    if decision_maker_id:
        for node in nodes:
            if node["id"] != decision_maker_id:
                edges.append(
                    {
                        "id": f"{node['id']}-{decision_maker_id}",
                        "source": node["id"],
                        "target": decision_maker_id,
                        "label": "reports to",
                    }
                )

    return {"nodes": nodes, "edges": edges}