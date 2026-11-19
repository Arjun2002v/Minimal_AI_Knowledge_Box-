import { AskPanel } from './components/AskPanel';
import { IngestForm } from './components/IngestForm';
import { ItemList } from './components/ItemList';

export const App = () => (
  <div className="page">
    <header className="page-header">
      <h1>Knowledge Box</h1>
      <p className="muted">Save notes and links, then ask questions about them.</p>
    </header>

    <main className="layout">
      <div className="column">
        <IngestForm />
        <ItemList />
      </div>
      <div className="column">
        <AskPanel />
      </div>
    </main>
  </div>
);
