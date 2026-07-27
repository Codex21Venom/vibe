import os
import json
from typing import Dict, List, Optional
from fastapi import HTTPException
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.agents import create_agent
from langchain.agents.structured_output import ToolStrategy

from arena_schema import ARENA_QUESTION_SCHEMA
from models import ArenaQuestionRequest, ArenaQuestionResponse

class ArenaService:
    DEFAULT_MODEL = "gemini-3.6-flash"

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        self.model = ChatGoogleGenerativeAI(
            model=self.DEFAULT_MODEL,
            google_api_key=api_key,
            temperature=0.7,
            timeout=300,
        )

    def _build_agent(self, schema: dict, system_prompt: str):
        return create_agent(
            model=self.model,
            tools=[],
            response_format=ToolStrategy(schema),
            system_prompt=system_prompt,
        )

    def _build_system_prompt(self) -> str:
        return (
            "You are an expert educational game designer creating content for 'Knowledge Clash', "
            "a strategic card game where 'cards' represent educational concepts. "
            "Generate a challenging educational question or scenario strictly following the provided schema. "
            "The correct answers (cards) and incorrect answers (distractor cards) must be plausible and educational."
        )

    async def generate_arena_question(self, request: ArenaQuestionRequest) -> ArenaQuestionResponse:
        system_prompt = self._build_system_prompt()
        
        prompt_text = (
            f"Based on the course '{request.course_name}' and specifically the following completed topics: "
            f"{', '.join(request.completed_topics)}.\n\n"
            f"Create a {request.difficulty} difficulty question or scenario. "
            "The 'correct_cards' should be the concepts required to answer the question or solve the scenario. "
            "The 'distractor_cards' should be other plausible concepts from the completed topics that are incorrect for this specific scenario. "
            "Each card should include an explanation of why it is correct or incorrect."
        )

        agent = self._build_agent(ARENA_QUESTION_SCHEMA, system_prompt)

        try:
            result = await agent.ainvoke({
                "messages": [{"role": "user", "content": prompt_text}]
            })
            
            structured = result.get("structured_response")
            if not structured:
                raise Exception("Failed to generate structured response")
            
            return ArenaQuestionResponse(**structured)
            
        except Exception as e:
            print(f"Error generating arena question: {e}")
            raise HTTPException(status_code=500, detail=str(e))
