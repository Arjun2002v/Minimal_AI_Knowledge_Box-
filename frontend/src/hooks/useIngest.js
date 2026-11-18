// Saves a note or URL with useSWRMutation. On success the new item is added
// to the cached '/items' list directly, so the list updates without a refetch.
import useSWRMutation from 'swr/mutation';
import { ingest } from '../api/client';
import { ITEMS_KEY } from './useItems';

const saveItem = (_key, { arg }) => ingest(arg);

export const useIngest = () => {
  const { trigger, isMutating, error, reset } = useSWRMutation(ITEMS_KEY, saveItem, {
    populateCache: (result, current) => ({ items: [result.item, ...(current?.items ?? [])] }),
    revalidate: false,
    throwOnError: false,
  });

  /** Returns true if the item was saved. */
  const submit = async (input) => Boolean(await trigger(input));

  return { submit, pending: isMutating, error, clearError: reset };
};
