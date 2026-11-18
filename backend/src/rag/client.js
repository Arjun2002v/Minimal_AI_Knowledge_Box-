// Shared OpenAI-SDK client pointed at Gemini's OpenAI-compatible endpoint.
import OpenAI from 'openai';
import { env } from '../config/env.js';

export const llmClient = new OpenAI({
  apiKey: env.GEMINI_API_KEY,
  baseURL: env.LLM_BASE_URL,
  // The SDK retries 429/5xx with backoff; Gemini's free tier rate-limits aggressively.
  maxRetries: 2,
  timeout: 30_000,
});
