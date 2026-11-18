// Splits text into overlapping chunks along paragraph / line / sentence / word boundaries.
// Uses LangChain's RecursiveCharacterTextSplitter: it tries the first separator, and only
// falls back to the next one for pieces that are still longer than chunkSize.
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const SEPARATORS = ['\n\n', '\n', '. ', '? ', '! ', ' ', ''];

/**
 * @param {{ chunkSize: number, chunkOverlap: number }} options
 * @returns {(text: string) => Promise<string[]>}
 */
export const createChunker = ({ chunkSize, chunkOverlap }) => {
  if (chunkOverlap >= chunkSize) throw new Error('chunkOverlap must be smaller than chunkSize');

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap, separators: SEPARATORS });

  return async (text) => {
    const chunks = await splitter.splitText(text.trim());
    // The splitter keeps a sentence separator at the start of the next chunk ("? Next…"); drop it.
    return chunks.map((c) => c.replace(/^[.?!]\s+/, '').trim()).filter(Boolean);
  };
};
