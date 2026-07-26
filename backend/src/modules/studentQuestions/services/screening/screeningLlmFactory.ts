import {screeningConfig} from '#root/config/screening.js';
import {ScreeningLlm} from './ScreeningLlm.js';
import {GeminiScreeningLlm} from './GeminiScreeningLlm.js';

/** Pick the screening LLM implementation from config (gemini). */
export function createScreeningLlm(): ScreeningLlm {
  return new GeminiScreeningLlm();
}
