export class ApiError extends Error {
  constructor(message, status, code, fieldErrors = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

const request = async (path, options = {}) => {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      ...options,
      headers: { 'content-type': 'application/json', ...options.headers },
    });
  } catch {
    throw new ApiError('Could not reach the server. Is the backend running?', 0, 'NETWORK_ERROR');
  }

  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(err?.message ?? `Request failed (${res.status})`, res.status, err?.code ?? 'UNKNOWN', err?.details);
  }
  return body;
};

export const fetcher = (path) => request(path);

export const ingest = (input) => request('/ingest', { method: 'POST', body: JSON.stringify(input) });

export const askQuestion = (question) => request('/query', { method: 'POST', body: JSON.stringify({ question }) });
