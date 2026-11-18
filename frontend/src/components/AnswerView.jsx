// Rendered answer with inline [n] citations that jump to the matching source below.
import { SourceSnippet } from './SourceSnippet';

const CITATION_SPLIT = /(\[\d+(?:\s*,\s*\d+)*\])/; // capture group keeps the markers in split()
const IS_CITATION = /^\[\d+(?:\s*,\s*\d+)*\]$/;

/** Splits the answer into text and citation links. Unknown numbers stay as plain text. */
const renderWithCitations = (answer, knownNumbers) =>
  answer.split(CITATION_SPLIT).map((part, i) => {
    if (!IS_CITATION.test(part)) return part;

    const numbers = part.slice(1, -1).split(',').map((s) => Number(s.trim()));
    if (!numbers.every((n) => knownNumbers.has(n))) return part;

    return (
      <sup key={i} className="citation">
        {numbers.map((n) => (
          <a key={n} href={`#source-${n}`}>
            {n}
          </a>
        ))}
      </sup>
    );
  });

export const AnswerView = ({ answer, sources }) => {
  const knownNumbers = new Set(sources.map((s) => s.n));

  return (
    <div className="answer">
      <p className="answer-text">{renderWithCitations(answer, knownNumbers)}</p>

      {sources.length > 0 && (
        <>
          <h3 className="sources-heading">Sources</h3>
          <ol className="source-list">
            {sources.map((source) => (
              <SourceSnippet key={source.n} source={source} />
            ))}
          </ol>
        </>
      )}
    </div>
  );
};
