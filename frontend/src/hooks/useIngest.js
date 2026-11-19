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

  const submit = async (input) => Boolean(await trigger(input));

  return { submit, pending: isMutating, error, clearError: reset };
};
