import { GoogleGenAI, Type } from "@google/genai";
import { config } from "dotenv";
config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const responseSchema = {
    type: Type.OBJECT,
    properties: {
        promptText: { type: Type.STRING, description: "The generated scenario or question" },
        deck: {
            type: Type.ARRAY,
            description: "An array of exactly 5 cards mixing correct answers and distractor concepts.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "Concept Name" },
                    explanation: { type: Type.STRING, description: "Why this concept is correct or incorrect for the scenario" },
                    isCorrect: { type: Type.BOOLEAN, description: "True if this concept is part of the correct answer, False if it is a distractor" }
                },
                required: ["name", "explanation", "isCorrect"]
            }
        },
        explanation: { type: Type.STRING, description: "Global learning tip for the scenario" }
    },
    required: ["promptText", "deck", "explanation"]
};

const prompt = `You are the AI opponent in a competitive strategy card game called Knowledge Clash.
The player is studying the course: "Advanced Graphics Architectures".

CRITICAL RULE: You MUST NOT use any external knowledge. Every single fact, concept, or answer you generate must be explicitly tied to the provided course context.
Your goal is to generate a challenge question or scenario based ONLY on the concepts found in this context.

COURSE DESCRIPTION:
"This course explores advanced GPU features, including path tracing at 1440p with performance FSR4 and frame generation on the RX-970XT. A key drawback mentioned is high VRAM usage which can lead to stuttering."

Based on the course 'Advanced Graphics Architectures' and specifically the following completed topics: General Course Context. Create an intermediate difficulty question or scenario.

You MUST generate EXACTLY 5 cards in the deck. Some must be correct concepts required to solve the scenario, and others must be highly plausible but incorrect distractor concepts. Each card must include an explanation of why it is correct or incorrect.`;

async function run() {
    try {
        console.log("Calling GoogleGenAI...");
        const response = await ai.models.generateContent({
            model: "gemini-3.6-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema
            }
        });
        console.log("SUCCESS:", response.text);
    } catch (e) {
        console.error("ERROR:", e);
    }
}
run();
