import json
import os
from typing import Dict, List, Optional
import asyncio
from fastapi import HTTPException
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage

from schema import SOL_SCHEMA, SML_SCHEMA, OTL_SCHEMA, NAT_SCHEMA, DES_SCHEMA
from models import QuestionGenerationParameters


class QuestionGenerationService:
    """Service for generating questions from transcript segments.

    Uses LangChain 1.0 create_agent + ToolStrategy for structured output,
    backed by Gemini.
    """

    DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.6-flash")

    def __init__(self):
        api_key = os.getenv("GEMINI_API_KEY")

        self.model = ChatGoogleGenerativeAI(
            model=self.DEFAULT_MODEL,
            google_api_key=api_key,
            temperature=0,
            timeout=300,
        )

        self.active_jobs: Dict[str, bool] = {}  # job_id -> cancelled flag

        self.question_schemas = {
            "SOL": SOL_SCHEMA,
            "SML": SML_SCHEMA,
            "OTL": OTL_SCHEMA,
            "NAT": NAT_SCHEMA,
            "DES": DES_SCHEMA,
            "BIN": SOL_SCHEMA,
        }

    def _get_model(self, model_name: str) -> ChatGoogleGenerativeAI:
        """Return a model instance, reusing the default or building a new one."""
        if model_name == self.DEFAULT_MODEL:
            return self.model
        api_key = os.getenv("GEMINI_API_KEY")
        return ChatGoogleGenerativeAI(
            model=model_name,
            google_api_key=api_key,
            temperature=0,
            timeout=300,
        )

    def _build_schema(self, base_schema: dict, count: int) -> dict:
        """
        Build the output schema for the given count.

        OpenAI function-calling (used by ToolStrategy) requires the top-level
        parameters schema to be type:object — a bare type:array is rejected with
        a 400. When count > 1 we wrap the array inside an object so the constraint
        is satisfied, then unwrap the result in _unwrap_questions().
        """
        if count == 1:
            return base_schema
        return {
            "type": "object",
            "properties": {
                "questions": {
                    "type": "array",
                    "items": base_schema,
                    "minItems": count,
                    "maxItems": count,
                }
            },
            "required": ["questions"],
        }

    def _unwrap_questions(self, result: dict | list, count: int) -> dict | list:
        """Unwrap the object envelope added by _build_schema when count > 1."""
        if count > 1 and isinstance(result, dict) and "questions" in result:
            return result["questions"]
        return result

    def _build_agent(self, model: ChatGoogleGenerativeAI, schema: dict):
        """Create a Runnable with structured output."""
        schema_copy = dict(schema) if schema else {}
        if "title" not in schema_copy:
            schema_copy["title"] = "QuestionSchema"
        return model.with_structured_output(schema_copy)

    def _build_system_prompt(self) -> str:
        return (
            "You are an expert educational content creator. "
            "Generate high-quality questions strictly following the provided schema. "
            "Do not mention the word 'transcript'; use the word 'video' instead."
        )

    def create_question_prompt(
        self,
        question_type: str,
        count: int,
        transcript_content: str,
        base_prompt: str,
    ) -> str:
        """Build the user-facing generation prompt for a given question type."""
        prompt = (
            f"Based on the following video content, generate {count} "
            f"educational question(s) of type {question_type}.\n\n"
            f"Video content:\n{transcript_content}\n\n"
            f"Each question should:\n{base_prompt}\n\n"
        )

        type_specific_instructions = {
            "BIN": """Create BINARY questions:
- Focus on understanding concepts, principles, or cause-and-effect relationships
- Avoid questions about specific numbers, percentages, or statistical data
- Clear question text that tests comprehension of ideas
- 1 incorrect option with explanations that address common misconceptions
- 1 correct option with explanation that reinforces the concept
- Options should have text in the form of True/False or Yes/No
- There should only be 2 options in total
- Include a hint that points to the key concept or principle being tested
- Set timeLimitSeconds to 60 and points to 5""",

            "SOL": """Create SELECT_ONE_IN_LOT questions:
- Focus on understanding concepts, principles, or cause-and-effect relationships
- Avoid questions about specific numbers, percentages, or statistical data
- Clear question text that tests comprehension of ideas
- 3 or more incorrect options with explanations that address common misconceptions
- 1 correct option with explanation that reinforces the concept
- Total options should be at least 3 and at most 6
- Include a hint that points to the key concept or principle being tested
- Set timeLimitSeconds to 60 and points to 5""",

            "SML": """Create SELECT_MANY_IN_LOT questions (multiple correct answers):
- Test understanding of multiple related concepts or characteristics
- Focus on identifying key principles, factors, or elements discussed
- Avoid numerical data or statistical information
- Clear question text about conceptual relationships
- 2-3 incorrect options with explanations
- 2-3 correct options with explanations that reinforce understanding
- Include a hint that mentions the number of correct answers or key criteria
- Set timeLimitSeconds to 90 and points to 8""",

            "OTL": """Create ORDER_THE_LOTS questions (ordering/sequencing):
- Focus on logical sequences, processes, or hierarchical relationships
- Test understanding of how concepts build upon each other
- Avoid chronological ordering based on specific dates or times
- Clear question text asking to order concepts, steps, or principles
- 3-5 items that need to be ordered based on logical flow or importance
- Each item should represent a concept with explanation of its position
- Order should be numbered starting from 1
- Include a hint about the ordering logic or key principle to consider
- Set timeLimitSeconds to 120 and points to 10""",

            "NAT": """Create NUMERIC_ANSWER_TYPE questions (numerical answers):
- Focus on conceptual calculations or estimations rather than exact figures from the content
- Ask for ratios, proportions, or relative comparisons that require understanding
- Avoid questions asking for specific numbers mentioned in the content
- Test ability to apply concepts to derive approximate or relative numerical answers
- Questions should require reasoning and application rather than recall
- Appropriate decimal precision (0-3)
- Realistic ranges that test conceptual understanding
- Include a hint about the mathematical relationship or concept to apply
- Set timeLimitSeconds to 90 and points to 6""",

            "DES": """Create DESCRIPTIVE questions (text-based answers):
- Focus on explaining concepts, analyzing relationships, or evaluating ideas
- Test deep understanding through explanation and reasoning
- Avoid questions asking to repeat specific facts or figures
- Ask for analysis of why concepts work, how they relate, or what they imply
- Questions that require synthesis and application of multiple ideas
- Detailed solution text that demonstrates analytical thinking
- Include a hint that suggests the key aspects or framework to consider
- Set timeLimitSeconds to 300 and points to 15""",
        }

        return prompt + type_specific_instructions.get(
            question_type, f"Generate question of type {question_type}."
        )

    async def generate_questions(
        self,
        segments: Dict[str, str],
        question_params: Optional["QuestionGenerationParameters"] = None,
        job_id: str = None,
    ) -> List[str]:
        """Generate questions based on segments and question specifications."""

        if not segments or not isinstance(segments, dict):
            raise HTTPException(
                status_code=400,
                detail=(
                    "segments is required and must be a non-empty object "
                    "with segmentId as keys and transcript as values."
                ),
            )

        if job_id:
            self.active_jobs[job_id] = False  # False = not cancelled

        try:
            # Resolve model
            model_name = (
                question_params.model
                if question_params
                and question_params.model
                and question_params.model != "default"
                else self.DEFAULT_MODEL
            )
            model = self._get_model(model_name)

            print(question_params)

            question_specs = {
                "SOL": question_params.SOL if question_params and question_params.SOL is not None else 2,
                "BIN": question_params.BIN if question_params and question_params.BIN is not None else 2,
                "SML": question_params.SML if question_params and question_params.SML is not None else 2,
                "NAT": question_params.NAT if question_params and question_params.NAT is not None else 0,
                "DES": question_params.DES if question_params and question_params.DES is not None else 0,
            }

            print(question_specs)

            base_prompt = (
                question_params.prompt
                if question_params and question_params.prompt
                else """
- Focus on conceptual understanding
- Test comprehension of key ideas, principles, and relationships discussed in the content
- Avoid questions that require memorizing exact numerical values, dates, or statistics mentioned in the content
- The answer of questions should be present within the content, but not directly quoted
- Make all the options roughly the same length
- Set isParameterized to false unless the question uses variables
"""
            )

            system_prompt = self._build_system_prompt()
            all_generated_questions: List[str] = []

            for segment_id, segment_transcript in segments.items():
                if not segment_transcript:
                    continue

                for question_type, count in question_specs.items():
                    if not (isinstance(count, int) and count > 0):
                        continue

                    # Check for cancellation before each call
                    if job_id and self.active_jobs.get(job_id):
                        print(f"Task cancelled for job {job_id}, stopping question generation")
                        raise asyncio.CancelledError("Task was cancelled")

                    try:
                        base_schema = self.question_schemas.get(question_type)
                        schema = self._build_schema(base_schema, count) if base_schema else None

                        prompt_text = self.create_question_prompt(
                            question_type, count, segment_transcript, base_prompt
                        )

                        agent = self._build_agent(model, schema)

                        max_api_retries = 3
                        result = None
                        for attempt in range(max_api_retries):
                            try:
                                result = await agent.ainvoke([
                                    SystemMessage(content=system_prompt),
                                    HumanMessage(content=prompt_text),
                                ])
                                break
                            except Exception as invoke_err:
                                if "429" in str(invoke_err) or "RESOURCE_EXHAUSTED" in str(invoke_err):
                                    if attempt < max_api_retries - 1:
                                        print(f"API Rate limit hit (429). Retrying attempt {attempt+1}/{max_api_retries} in 35 seconds...")
                                        await asyncio.sleep(35)
                                    else:
                                        raise invoke_err
                                else:
                                    raise invoke_err

                        questions = self._unwrap_questions(
                            result, count
                        )

                        # Annotate with routing metadata
                        if isinstance(questions, list):
                            for q in questions:
                                q["segmentId"] = segment_id
                                q["questionType"] = question_type
                        elif isinstance(questions, dict):
                            questions["segmentId"] = segment_id
                            questions["questionType"] = question_type

                        all_generated_questions.append(
                            json.dumps(questions, ensure_ascii=False)
                        )

                    except asyncio.CancelledError:
                        raise

                    except Exception as error:
                        print(
                            f"Error generating {question_type} questions "
                            f"for segment {segment_id}: {error}"
                        )

            return all_generated_questions

        finally:
            if job_id and job_id in self.active_jobs:
                del self.active_jobs[job_id]

    def cancel_generation(self, job_id: str) -> None:
        """Signal cancellation for an in-progress generation job."""
        if job_id in self.active_jobs:
            self.active_jobs[job_id] = True
            print(f"Cancelled question generation session for job {job_id}")