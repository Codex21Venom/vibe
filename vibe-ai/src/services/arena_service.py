import os
import json
from typing import Dict, List, Optional
from fastapi import HTTPException
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from arena_schema import ARENA_QUESTION_SCHEMA
from models import ArenaQuestionRequest, ArenaQuestionResponse

class ArenaService:
    DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")
        self.model = ChatGoogleGenerativeAI(
            model=self.DEFAULT_MODEL,
            google_api_key=api_key,
            temperature=0.7,
            timeout=300,
        )

    def _build_system_prompt(self) -> str:
        return (
            "You are an expert educational game designer creating content for 'Knowledge Clash', "
            "a strategic card game where 'cards' represent educational concepts. "
            "STRICT PROGRESS SCOPING RULE: You MUST ONLY generate questions and concept cards from the user's completed course content. "
            "Under no circumstances generate cards or questions for unlearned or future topics outside the user's completed progress. "
            "QUESTION VARIETY RULE: Vary the question style (e.g., scenario analysis, concept distinction, diagnostic logic, practical application) across invocations."
        )

    async def generate_arena_question(self, request: ArenaQuestionRequest) -> ArenaQuestionResponse:
        system_prompt = self._build_system_prompt()
        
        prompt_text = (
            f"Based on the course '{request.course_name}' and STRICTLY limited to the following completed topics up to the student's progress: "
            f"{', '.join(request.completed_topics)}.\n\n"
        )
        
        if request.transcript_text:
            prompt_text += f"Here is the completed course transcript for context to generate highly accurate questions based on what was taught:\n{request.transcript_text}\n\n"

        prompt_text += (
            f"Create a {request.difficulty} difficulty question or scenario strictly bounded by these completed topics. "
            "DO NOT include any advanced unlearned concepts. "
            "The 'correct_cards' should be the concepts required to answer the question or solve the scenario. "
            "The 'distractor_cards' should be other plausible concepts from the completed topics that are incorrect for this specific scenario. "
            "Each card should include an explanation of why it is correct or incorrect."
        )

        schema = dict(ARENA_QUESTION_SCHEMA)
        if "title" not in schema:
            schema["title"] = "ArenaQuestionSchema"
        structured_llm = self.model.with_structured_output(schema)

        try:
            result = await structured_llm.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=prompt_text),
            ])
            
            if not result:
                raise Exception("Failed to generate structured response")
            
            return ArenaQuestionResponse(**result)
            
        except Exception as e:
            print(f"Error generating arena question: {e}")
            raise HTTPException(status_code=500, detail=str(e))
