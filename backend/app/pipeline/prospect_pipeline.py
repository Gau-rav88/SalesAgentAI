from app.agents.guardrail.agent import GuardrailAgent
from app.agents.intent.agent import IntentAgent
from app.agents.knowledge_ingestion.agent import KnowledgeIngestionAgent
from app.agents.persona.agent import PersonaAgent
from app.agents.strategy.agent import StrategyAgent


class ProspectPipeline:
    """
    Central orchestration pipeline.

    Current flow:

    Research (to be added)
        ↓
    Knowledge Ingestion
        ↓
    Persona
        ↓
    Intent
        ↓
    Strategy
        ↓
    Guardrail
    """

    def __init__(self):
        self.ingestion = KnowledgeIngestionAgent()
        self.persona = PersonaAgent()
        self.intent = IntentAgent()
        self.strategy = StrategyAgent()
        self.guardrail = GuardrailAgent()

    async def run(self, text: str):

        # ResearchAgentV2 will be plugged in here later.

        normalized = await self.ingestion.ingest(
            text=text,
        )

        knowledge = normalized["knowledge"]

        persona = await self.persona.analyze(
            knowledge,
        )

        intent = await self.intent.analyze(
            knowledge,
        )

        strategy = await self.strategy.generate(
            knowledge,
            persona,
            intent,
        )

        guardrail = await self.guardrail.verify(
            knowledge,
            persona,
            intent,
            strategy,
        )

        return {
            "knowledge": knowledge,
            "persona": persona,
            "intent": intent,
            "strategy": strategy,
            "guardrail": guardrail,
        }