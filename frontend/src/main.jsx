// React root. <SWRConfig> sets the fetcher and caching options for every useSWR call.
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { fetcher } from './api/client';
import { App } from './App';
import './styles/index.css';

const swrOptions = {
  fetcher,
  revalidateOnFocus: true, // refresh the list when you come back to the tab
  dedupingInterval: 2000, // identical requests within 2s share one network call
  // Retry network / server errors a few times, but not 4xx (those won't fix themselves).
  onErrorRetry: (error, _key, _config, revalidate, { retryCount }) => {
    if (error.status >= 400 && error.status < 500) return;
    if (retryCount >= 3) return;
    setTimeout(() => revalidate({ retryCount }), 2000 * (retryCount + 1));
  },
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <SWRConfig value={swrOptions}>
      <App />
    </SWRConfig>
  </StrictMode>,
);
