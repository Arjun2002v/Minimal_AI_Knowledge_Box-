import useSWRMutation from 'swr/mutation';
import { askQuestion } from '../api/client';

const ask = (_key, { arg: question }) => askQuestion(question);

export const useAsk = () => {
  const { trigger, data, isMutating, error, reset } = useSWRMutation('/query', ask, { throwOnError: false });

  return {
    ask: (question) => trigger(question),
    result: data,
    pending: isMutating,
    error,
    reset,
  };
};
