// Turns errors from the AI provider into an UpstreamError (502) with a readable message.
import { UpstreamError } from '../lib/errors.js';

export const toUpstreamError = (err, action) => {
  const status = err?.status ?? err?.response?.status;
  const text = String(err?.message ?? err);

  let reason = 'the AI provider returned an error';
  if (status === 429 || /429|quota|rate limit/i.test(text)) reason = 'the AI provider rate limit was hit, try again in a minute';
  else if (status === 503 || /503|overloaded|high demand/i.test(text)) reason = 'the AI model is overloaded right now, try again shortly';
  else if (err?.name === 'TimeoutError' || err?.name === 'AbortError') reason = 'the AI provider took too long to respond';
  else if (status === 400 || status === 401 || status === 403 || /API key/i.test(text)) reason = 'the AI provider rejected the request (check GEMINI_API_KEY and model names)';

  const upstream = new UpstreamError(`${action} failed: ${reason}`);
  upstream.cause = err; // logged by the error handler, never sent to the client
  return upstream;
};
