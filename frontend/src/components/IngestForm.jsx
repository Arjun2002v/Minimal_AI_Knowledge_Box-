// Note / URL toggle with input and submit.
import { useState } from 'react';
import { useIngest } from '../hooks/useIngest';
import { ErrorBanner } from './ErrorBanner';

export const IngestForm = () => {
  const [mode, setMode] = useState('note'); // 'note' | 'url'
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const { submit, pending, error, clearError } = useIngest();

  const canSubmit = !pending && (mode === 'note' ? content.trim() : url.trim());

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    const input =
      mode === 'note'
        ? { type: 'note', content, ...(title.trim() && { title }) }
        : { type: 'url', url: url.trim() };

    const ok = await submit(input);
    if (ok) {
      setTitle('');
      setContent('');
      setUrl('');
    }
  };

  const switchMode = (next) => {
    setMode(next);
    clearError();
  };

  return (
    <form className="card" onSubmit={handleSubmit}>
      <div className="card-header">
        <h2>Add to your box</h2>
        <div className="segmented" role="tablist" aria-label="Item type">
          {['note', 'url'].map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              className={mode === m ? 'active' : ''}
              onClick={() => switchMode(m)}
            >
              {m === 'note' ? 'Note' : 'URL'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'note' ? (
        <>
          <label>
            <span>Title (optional)</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Defaults to the first line" maxLength={200} />
          </label>
          <label>
            <span>Note</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={6} placeholder="Paste or type anything worth remembering…" />
          </label>
        </>
      ) : (
        <label>
          <span>Page URL</span>
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" />
          <small className="hint">The server downloads the page and keeps its readable text.</small>
        </label>
      )}

      <ErrorBanner error={error} onDismiss={clearError} />

      <button type="submit" className="primary" disabled={!canSubmit}>
        {pending ? (mode === 'url' ? 'Fetching page…' : 'Saving…') : 'Save'}
      </button>
    </form>
  );
};
