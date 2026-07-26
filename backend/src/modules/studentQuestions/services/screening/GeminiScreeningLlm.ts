import { GoogleGenAI } from '@google/genai';
import {screeningConfig} from '#root/config/screening.js';
import {ScreeningLlm, ScreeningLlmError, parseJsonObject} from './ScreeningLlm.js';

/**
 * Gemini implementation. Enabled by SCREENING_PROVIDER=gemini.
 *
 * The prompts already instruct "reply ONLY with JSON"; we set a tiny system
 * prompt reinforcing that and parse defensively.
 */
export class GeminiScreeningLlm implements ScreeningLlm {
  readonly provider = 'gemini';
  readonly model = screeningConfig.gemini.model;

  async askJson(prompt: string): Promise<Record<string, unknown>> {
    const {apiKey, model} = screeningConfig.gemini;
    if (!apiKey) throw new ScreeningLlmError('GEMINI_API_KEY not set');

    const ai = new GoogleGenAI({ apiKey });

    try {
      const response = await ai.models.generateContent({
        model: model,
        contents: prompt,
        config: {
          systemInstruction: 'You are a strict screening classifier. Reply with ONLY a single JSON object — no prose, no code fences.',
          temperature: 0.0,
          responseMimeType: 'application/json'
        }
      });
      
      const text = response.text || '';
      return parseJsonObject(text);
    } catch (err) {
      if (err instanceof ScreeningLlmError) throw err;
      throw new ScreeningLlmError('gemini call failed', err);
    }
  }
}
