// One cited source: number, title/URL, and the chunk of text that matched.
export const SourceSnippet = ({ source }) => (
  <li id={`source-${source.n}`} className="source">
    <div className="source-header">
      <span className="source-number">{source.n}</span>
      <span className={`badge badge-${source.type}`}>{source.type === 'url' ? 'Link' : 'Note'}</span>
      {source.url ? (
        <a href={source.url} target="_blank" rel="noreferrer" className="source-title">
          {source.title}
        </a>
      ) : (
        <span className="source-title">{source.title}</span>
      )}
      <span className="muted source-score" title="Cosine similarity between the question and this chunk">
        {source.score.toFixed(2)}
      </span>
    </div>
    <p className="source-snippet">{source.snippet}</p>
  </li>
);
