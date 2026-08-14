from sqlalchemy.orm import Session

from app.models.analysis_result import AnalysisResult
from app.models.outreach_draft import OutreachDraft


class OutreachService:
    """
    Turns an approved analysis (persona + strategy + guardrail) into a
    grounded, editable outreach draft that a human reviews before it can
    be marked approved. Nothing here sends anything — this only manages
    the draft's lifecycle in the database.
    """

    def generate_from_analysis(
        self,
        db: Session,
        user_id: int,
        analysis: AnalysisResult,
    ) -> OutreachDraft:

        persona = analysis.persona or {}
        strategy = analysis.strategy or {}
        guardrail = analysis.guardrail or {}

        stakeholder_name = persona.get("primary_decision_maker", "") or "Unknown contact"

        next_action = strategy.get("next_best_action", "") or "Follow up"

        subject = (
            strategy.get("email_subject")
            or strategy.get("account_summary", "")
            or f"Following up: {next_action}"
        )
        if len(subject) > 120:
            subject = subject[:117] + "..."

        body = strategy.get("email_body") or next_action
        if isinstance(body, list):
            body = "\n".join(str(item) for item in body)
        if not body:
            body = next_action

        evidence = guardrail.get("supported_claims", []) or []

        draft = OutreachDraft(
            user_id=user_id,
            company_id=analysis.company_id,
            analysis_id=analysis.id,
            stakeholder_name=stakeholder_name,
            channel="email",
            subject=str(subject),
            body=str(body),
            confidence=int(guardrail.get("confidence", 0) or 0),
            reasoning=str(guardrail.get("reasoning", "")),
            evidence=evidence,
            status="pending",
        )

        db.add(draft)
        db.commit()
        db.refresh(draft)

        return draft

    def list_for_user(self, db: Session, user_id: int):
        return (
            db.query(OutreachDraft)
            .filter(OutreachDraft.user_id == user_id)
            .order_by(OutreachDraft.created_at.desc())
            .all()
        )

    def get(self, db: Session, user_id: int, draft_id: int):
        return (
            db.query(OutreachDraft)
            .filter(
                OutreachDraft.id == draft_id,
                OutreachDraft.user_id == user_id,
            )
            .first()
        )

    def set_status(
        self,
        db: Session,
        user_id: int,
        draft_id: int,
        status: str,
    ):
        draft = self.get(db, user_id, draft_id)

        if draft is None:
            return None

        draft.status = status
        db.commit()
        db.refresh(draft)

        return draft

    def update_body(
        self,
        db: Session,
        user_id: int,
        draft_id: int,
        subject: str | None = None,
        body: str | None = None,
    ):
        draft = self.get(db, user_id, draft_id)

        if draft is None:
            return None

        if subject is not None:
            draft.subject = subject

        if body is not None:
            draft.body = body

        draft.status = "edited"

        db.commit()
        db.refresh(draft)

        return draft