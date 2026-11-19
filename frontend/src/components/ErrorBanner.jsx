import { ApiError } from '../api/client';

export const ErrorBanner = ({ error, onDismiss }) => {
  if (!error) return null;
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : [];

  return (
    <div className="error-banner" role="alert">
      <div>
        <strong>{error.message}</strong>
        {fieldErrors.length > 0 && (
          <ul>
            {fieldErrors.map((f) => (
              <li key={f.field + f.message}>{f.message}</li>
            ))}
          </ul>
        )}
      </div>
      {onDismiss && (
        <button type="button" className="link-button" onClick={onDismiss} aria-label="Dismiss error">
          ✕
        </button>
      )}
    </div>
  );
};
