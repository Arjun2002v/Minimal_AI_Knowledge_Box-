import { ChatPromptTemplate } from '@langchain/core/prompts';

export const NOT_FOUND_ANSWER = "I couldn't find anything about that in your saved items.";

export const answerPrompt = ChatPromptTemplate.fromMessages([
  [
    'system',
    `You answer questions using ONLY the numbered context blocks from the user's saved notes and web pages.
Rules:
- Cite every claim with the number of the block it came from, in square brackets, e.g. [1] or [2][3].
- If the blocks do not contain the answer, reply exactly: "${NOT_FOUND_ANSWER}"
- Do not use outside knowledge. Be concise.
- Write plain text, not Markdown.`,
  ],
  ['human', 'Context:\n\n{context}\n\nQuestion: {question}'],
]);

export const formatContext = (chunks) =>
  chunks
    .map((c, i) => `[${i + 1}] ${c.title}${c.url ? ` (${c.url})` : ''}\n${c.text}`)
    .join('\n\n');

export const citedBlockNumbers = (answer, blockCount) => {
  const numbers = new Set();
  for (const match of answer.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) {
    for (const n of match[1].split(',').map(Number)) {
      if (n >= 1 && n <= blockCount) numbers.add(n);
    }
  }
  return [...numbers].sort((a, b) => a - b);
};
