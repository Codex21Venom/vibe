import {env} from '#root/utils/env.js';

/**
 * Config for the crowd-question screening filter (studentQuestions module).
 *
 * Exclusively uses Gemini now.
 */
export const screeningConfig = {
  /** 'gemini' (prod). */
  provider: 'gemini' as const,

  /** Master switch — when off, submissions skip screening (fail-open, dev only). */
  enabled: (env('SCREENING_ENABLED') || 'true') !== 'false',

  /**
   * Context (lesson-relevance) checking. ON HOLD by default: until real
   * per-segment transcripts exist, the only available context is the weak
   * graded-stem proxy, which would risk false off-topic rejections. When on,
   * `createQuestion` feeds lesson context to BOTH the on-topic relevance gate and
   * (as a grounding hint) the answer-correctness check. Flip to true to enable.
   */
  contextCheckEnabled: (env('SCREENING_CONTEXT_ENABLED') || 'false') === 'true',

  gemini: {
    apiKey: env('GEMINI_API_KEY'),
    model: env('GEMINI_MODEL') || 'gemini-2.5-flash',
  },

  /** Per-call hard deadline (ms) — a slow provider must never hang a submission. */
  timeoutMs: Number(env('SCREENING_TIMEOUT_MS') || '9000'),
  /** Retries on transient/429 errors (with backoff). */
  maxRetries: Number(env('SCREENING_MAX_RETRIES') || '2'),

  /** Max graded-QB questions compared against for the duplicate check. */
  dedupPoolLimit: Number(env('SCREENING_DEDUP_LIMIT') || '50'),
  /** Transcript characters fed to the on-topic check (keeps cost bounded). */
  contextCharBudget: Number(env('SCREENING_CONTEXT_CHARS') || '2000'),
};
