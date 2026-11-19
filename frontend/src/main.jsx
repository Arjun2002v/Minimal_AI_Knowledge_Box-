import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SWRConfig } from 'swr';
import { fetcher } from './api/client';
import { App } from './App';
import './styles/index.css';

const swrOptions = {
  fetcher,
  revalidateOnFocus: true,
  dedupingInterval: 2000,
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
