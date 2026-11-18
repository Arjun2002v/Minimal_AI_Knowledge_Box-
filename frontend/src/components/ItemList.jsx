// List of saved items with type, timestamp, preview.
import { useItems } from '../hooks/useItems';
import { ErrorBanner } from './ErrorBanner';

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export const ItemList = () => {
  const { items, loading, error, refresh } = useItems();

  return (
    <section className="card">
      <div className="card-header">
        <h2>Saved items</h2>
        <span className="muted">{items.length > 0 && items.length}</span>
      </div>

      {error && (
        <>
          <ErrorBanner error={error} />
          <button type="button" className="secondary" onClick={refresh}>
            Try again
          </button>
        </>
      )}

      {!error && loading && <p className="muted">Loading…</p>}

      {!error && !loading && items.length === 0 && (
        <p className="muted empty">Nothing here yet. Save a note or a link to get started.</p>
      )}

      <ul className="item-list">
        {items.map((item) => (
          <li key={item.id} className="item">
            <div className="item-meta">
              <span className={`badge badge-${item.type}`}>{item.type === 'url' ? 'Link' : 'Note'}</span>
              <time dateTime={item.createdAt}>{dateFormat.format(new Date(item.createdAt))}</time>
            </div>
            <h3 className="item-title">
              {item.url ? (
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              ) : (
                item.title
              )}
            </h3>
            {item.url && <div className="item-url">{new URL(item.url).hostname}</div>}
            <p className="item-preview">{item.preview}</p>
          </li>
        ))}
      </ul>
    </section>
  );
};
