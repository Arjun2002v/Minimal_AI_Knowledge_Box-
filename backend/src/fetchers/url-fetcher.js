import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import * as cheerio from 'cheerio';
import { UnprocessableError, UpstreamError } from '../lib/errors.js';

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 5;

export const fetchUrl = async (inputUrl) => {
  const { response, finalUrl } = await fetchFollowingRedirects(inputUrl);

  if (!response.ok) {
    throw new UnprocessableError(`Could not fetch the page (HTTP ${response.status})`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isHtml = contentType.includes('text/html') || contentType.includes('application/xhtml');
  const isPlain = contentType.includes('text/plain');
  if (!isHtml && !isPlain) {
    throw new UnprocessableError(`Unsupported content type: ${contentType || 'unknown'}`);
  }

  const body = await readLimited(response);
  const page = isHtml ? extractFromHtml(body, finalUrl) : { title: new URL(finalUrl).hostname, text: body };
  const text = normalizeWhitespace(page.text);

  if (!text) throw new UnprocessableError('No readable text found on that page');
  return { url: finalUrl, title: page.title, text };
};

const fetchFollowingRedirects = async (startUrl) => {
  let url = startUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);

    let response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'user-agent': 'KnowledgeBox/0.1 (+personal knowledge inbox)', accept: 'text/html,text/plain' },
      });
    } catch (err) {
      const reason = err?.name === 'TimeoutError' ? 'timed out' : 'failed';
      throw new UpstreamError(`Fetching the page ${reason}`);
    }

    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      url = new URL(location, url).toString();
      continue;
    }
    return { response, finalUrl: url };
  }
  throw new UnprocessableError('Too many redirects');
};

// Don't let saved URLs point at localhost or the local network.
const assertPublicHost = async (url) => {
  const { hostname } = new URL(url);
  const host = hostname.replace(/^\[|\]$/g, '');
  let addresses;
  try {
    addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  } catch {
    throw new UnprocessableError(`Could not resolve host: ${hostname}`);
  }
  if (addresses.some(isPrivateAddress)) {
    throw new UnprocessableError('URLs pointing at private or local addresses are not allowed');
  }
};

const isPrivateAddress = (ip) => {
  const mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return isPrivateAddress(mapped[1]);

  if (isIP(ip) === 4) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const lower = ip.toLowerCase();
  return lower === '::' || lower === '::1' || /^f[cd]/.test(lower) || /^fe[89ab]/.test(lower);
};

const readLimited = async (response) => {
  const declared = Number(response.headers.get('content-length'));
  if (declared > MAX_BYTES) throw new UnprocessableError('Page is too large (limit is 2 MB)');
  if (!response.body) return '';

  const reader = response.body.getReader();
  const parts = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) {
      await reader.cancel();
      throw new UnprocessableError('Page is too large (limit is 2 MB)');
    }
    parts.push(value);
  }
  return Buffer.concat(parts).toString('utf8');
};

const extractFromHtml = (html, url) => {
  const $ = cheerio.load(html);
  const title =
    $('meta[property="og:title"]').attr('content')?.trim() ||
    $('title').first().text().trim() ||
    new URL(url).hostname;

  $('script, style, noscript, template, svg, iframe, nav, header, footer, aside, form').remove();

  $('br').replaceWith('\n');
  $('p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, tr, div, section, article').append('\n\n');

  let main = $('body');
  if ($('article').first().text().trim()) main = $('article').first();
  else if ($('main').first().text().trim()) main = $('main').first();

  return { title, text: main.text() };
};

const normalizeWhitespace = (text) => {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t\f\v ]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};
