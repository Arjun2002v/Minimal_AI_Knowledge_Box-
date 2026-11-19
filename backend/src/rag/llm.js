import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { toUpstreamError } from './ai-errors.js';
import { answerPrompt } from './prompt.js';

const TIMEOUT_MS = 45_000;

export const createAnswerGenerator = ({ apiKey, model }) => {
  const chatModel = new ChatGoogleGenerativeAI({ apiKey, model, temperature: 0.2, maxRetries: 2 });
  const chain = answerPrompt.pipe(chatModel).pipe(new StringOutputParser());

  return async ({ question, context }) => {
    try {
      const answer = await chain.invoke({ question, context }, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      return answer.trim();
    } catch (err) {
      throw toUpstreamError(err, 'Generating the answer');
    }
  };
};
