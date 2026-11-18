// HTTP-level tests for validation and status codes.
// Uses an in-memory DB and a fake URL fetcher, so no network is needed.
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { openDb } from '../src/db/client.js';
import { UnprocessableError } from '../src/lib/errors.js';

const fakeFetch = async (url) => {
  if (url.includes('broken')) throw new UnprocessableError('Could not fetch the page (HTTP 404)');
  return { url, title: 'Example article', text: 'Readable text from the page.' };
};

let app;
beforeEach(() => {
  app = createApp({ db: openDb(':memory:'), fetchUrl: fakeFetch });
});

describe('POST /api/ingest', () => {
  it('saves a note and returns 201 with the item', async () => {
    const res = await request(app).post('/api/ingest').send({ type: 'note', content: '  Buy milk\nand eggs  ' });
    assert.equal(res.status, 201);
    assert.equal(res.body.item.type, 'note');
    assert.equal(res.body.item.title, 'Buy milk');
    assert.equal(res.body.item.preview, 'Buy milk\nand eggs');
    assert.ok(res.body.item.id);
  });

  it('saves a URL using the fetched title and text', async () => {
    const res = await request(app).post('/api/ingest').send({ type: 'url', url: 'https://example.com/post' });
    assert.equal(res.status, 201);
    assert.equal(res.body.item.title, 'Example article');
    assert.equal(res.body.item.url, 'https://example.com/post');
  });

  const invalidBodies = [
    ['missing type', { content: 'hi' }],
    ['unknown type', { type: 'pdf', content: 'hi' }],
    ['empty note', { type: 'note', content: '   ' }],
    ['note without content', { type: 'note' }],
    ['malformed URL', { type: 'url', url: 'not a url' }],
    ['non-http URL', { type: 'url', url: 'ftp://example.com/file' }],
  ];
  for (const [name, body] of invalidBodies) {
    it(`returns 400 for ${name}`, async () => {
      const res = await request(app).post('/api/ingest').send(body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.ok(Array.isArray(res.body.error.details));
    });
  }

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app).post('/api/ingest').set('content-type', 'application/json').send('{"type": ');
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'INVALID_JSON');
  });

  it('returns 422 when the URL cannot be fetched, and saves nothing', async () => {
    const res = await request(app).post('/api/ingest').send({ type: 'url', url: 'https://broken.example.com' });
    assert.equal(res.status, 422);
    assert.equal(res.body.error.code, 'UNPROCESSABLE');

    const list = await request(app).get('/api/items');
    assert.equal(list.body.items.length, 0);
  });
});

describe('GET /api/items', () => {
  it('returns an empty list initially', async () => {
    const res = await request(app).get('/api/items');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items, []);
  });

  it('lists items newest first with a preview, not the full content', async () => {
    const long = 'x'.repeat(500);
    await request(app).post('/api/ingest').send({ type: 'note', content: 'first' });
    await request(app).post('/api/ingest').send({ type: 'note', content: long, title: 'second' });

    const res = await request(app).get('/api/items');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.items.map((i) => i.title), ['second', 'first']);
    assert.equal(res.body.items[0].preview.length, 200);
    assert.equal(res.body.items[0].content, undefined);
  });
});

describe('unknown routes', () => {
  it('returns 404 in the standard error shape', async () => {
    const res = await request(app).get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
