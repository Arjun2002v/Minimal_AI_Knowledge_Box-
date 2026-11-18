// Chat completion wrapper for answer generation (Gemini via OpenAI-compatible API).
import { env } from '../config/env.js';
import { llmClient } from './client.js';

/**
 * Returns the model's text answer for the given messages.
 * @param {{ role: 'system' | 'user' | 'assistant', content: string }[]} messages
 * @returns {Promise<string>}
 */
export const generateAnswer = async (messages) => {
  const res = await llmClient.chat.completions.create({
    model: env.CHAT_MODEL,
    messages,
    temperature: 0.2,
  });
  const content = res.choices[0]?.message?.content;
  if (!content) {
    throw new Error(`LLM returned no content (finish_reason: ${res.choices[0]?.finish_reason ?? 'unknown'})`);
  }
  return content;
};
