from app.agents.base import BaseAgent
from app.agents.decision import DecisionEngine


class ResearchAgent(BaseAgent):
    """
    General purpose research agent.
    """

    name = "research"
    description = "General purpose research agent."

    def __init__(self, llm, tools):
        super().__init__(llm, tools)
        self.decision = DecisionEngine(self.llm)

    async def run(self, task: str, **kwargs):
        """
        Execute the research agent.
        """

        tool = await self.decision.choose_tool(task)
        
        if tool:
        
            arguments = await self.decision.extract_arguments(
                tool,
                task,
            )
        
            tool_result = await self.tools.execute(
                tool,
                **arguments,
            )
        
            # Let the LLM summarize search results
            if tool == "search" and tool_result.get("success"):
            
                prompt = f"""
        User Question:
        {task}
        
        Search Results:
        {tool_result['results']}
        
        Write a clear answer using the search results.
        """
        
                llm_response = await self.llm.generate(prompt)
        
                return {
                    "agent": self.name,
                    "tool_used": tool,
                    "search_results": tool_result,
                    "response": llm_response,
                }
        
            return {
                "agent": self.name,
                "tool_used": tool,
                "response": tool_result,
            }

        # No tool was needed — answer directly instead of falling through
        # and returning None (which previously crashed the Supervisor).
        llm_response = await self.llm.generate(task)

        return {
            "agent": self.name,
            "tool_used": None,
            "response": llm_response,
        }