// Loads the saved items with SWR (cached under the '/items' key).
import useSWR from 'swr';

export const ITEMS_KEY = '/items';

export const useItems = () => {
  // The fetcher comes from <SWRConfig> in main.jsx.
  const { data, error, isLoading, mutate } = useSWR(ITEMS_KEY);

  return {
    items: data?.items ?? [],
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
};
