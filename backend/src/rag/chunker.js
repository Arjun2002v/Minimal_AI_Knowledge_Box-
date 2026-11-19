import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';

const SEPARATORS = ['\n\n', '\n', '. ', '? ', '! ', ' ', ''];

export const createChunker = ({ chunkSize, chunkOverlap }) => {
  if (chunkOverlap >= chunkSize) throw new Error('chunkOverlap must be smaller than chunkSize');

  const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap, separators: SEPARATORS });

  return async (text) => {
    const chunks = await splitter.splitText(text.trim());
    // Strip leftover punctuation the splitter leaves at the start of a chunk.
    return chunks.map((c) => c.replace(/^[.?!]\s+/, '').trim()).filter(Boolean);
  };
};
