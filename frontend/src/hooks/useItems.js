import useSWR from 'swr';

export const ITEMS_KEY = '/items';

export const useItems = () => {
  const { data, error, isLoading, mutate } = useSWR(ITEMS_KEY);

  return {
    items: data?.items ?? [],
    loading: isLoading,
    error,
    refresh: () => mutate(),
  };
};
