import { useState } from 'react';
import { useAsk } from '../hooks/useAsk';
import { AnswerView } from './AnswerView';
import { ErrorBanner } from './ErrorBanner';

export const AskPanel = () => {
  const [question, setQuestion] = useState('');
  const { ask, result, pending, error, reset } = useAsk();

  const canAsk = !pending && question.trim().length > 0;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (canAsk) ask(question.trim());
  };

  return (
    <section className="card">
      <div className="card-header">
        <h2>Ask your box</h2>
      </div>

      <form className="ask-form" onSubmit={handleSubmit}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="e.g. What did I save about Postgres vacuum?"
          maxLength={1000}
          aria-label="Question"
        />
        <button type="submit" className="primary" disabled={!canAsk}>
          {pending ? 'Thinking…' : 'Ask'}
        </button>
      </form>

      <ErrorBanner error={error} onDismiss={reset} />

      {pending && <p className="muted">Searching your items and writing an answer…</p>}
      {!pending && result && <AnswerView answer={result.answer} sources={result.sources} />}
      {!pending && !result && !error && (
        <p className="muted empty">Answers only use what you've saved, with numbered links to the sources.</p>
      )}
    </section>
  );
};
