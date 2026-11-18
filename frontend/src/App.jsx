// Page layout: ingest form + saved items.
// (The "ask a question" panel arrives with the RAG step.)
import { IngestForm } from './components/IngestForm';
import { ItemList } from './components/ItemList';

export const App = () => (
  <div className="page">
    <header className="page-header">
      <h1>Knowledge Box</h1>
      <p className="muted">Save notes and links in one place.</p>
    </header>

    <main className="layout">
      <IngestForm />
      <ItemList />
    </main>
  </div>
);
