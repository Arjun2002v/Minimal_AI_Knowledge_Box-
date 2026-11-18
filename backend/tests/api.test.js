// HTTP-level tests for validation and status codes.
// Uses an in-memory DB and fake fetcher / AI (see helpers.js), so no network or API key is needed.
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { UpstreamError } from '../src/lib/errors.js';
import { createTestApp } from './helpers.js';

let app;
let calls;
beforeEach(() => {
  ({ app, calls } = createTestApp());
});

describe('POST /api/ingest', () => {
  it('saves a note and returns 201 with the item and its chunk count', async () => {
    const res = await request(app).post('/api/ingest').send({ type: 'note', content: '  Buy milk\nand eggs  ' });
    assert.equal(res.status, 201);
    assert.equal(res.body.item.type, 'note');
    assert.equal(res.body.item.title, 'Buy milk');
    assert.equal(res.body.item.preview, 'Buy milk\nand eggs');
    assert.equal(res.body.item.chunkCount, 1);
    assert.ok(res.body.item.id);
  });

  it('saves a URL using the fetched title and text', async () => {
    const res = await request(app).post('/api/ingest').send({ type: 'url', url: 'https://example.com/post' });
    assert.equal(res.status, 201);
    assert.equal(res.body.item.title, 'Example article');
    assert.equal(res.body.item.url, 'https://example.com/post');
  });

  it('splits long content into several chunks', async () => {
    const content = Array.from({ length: 20 }, (_, i) => `Sentence number ${i} talks about databases.`).join(' ');
    const res = await request(app).post('/api/ingest').send({ type: 'note', content });
    assert.equal(res.status, 201);
    assert.ok(res.body.item.chunkCount > 1);
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

  it('returns 502 when embedding fails, and saves nothing', async () => {
    ({ app } = createTestApp({
      embedder: {
        embedDocuments: async () => {
          throw new UpstreamError('Embedding the content failed: the AI provider rate limit was hit');
        },
        embedQuery: async () => [],
      },
    }));
    const res = await request(app).post('/api/ingest').send({ type: 'note', content: 'hello' });
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'UPSTREAM_ERROR');

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

describe('POST /api/query', () => {
  const seed = async () => {
    await request(app).post('/api/ingest').send({ type: 'note', title: 'Postgres', content: 'Postgres VACUUM reclaims space from dead rows.' });
    await request(app).post('/api/ingest').send({ type: 'note', title: 'Cooking', content: 'Boil pasta for nine minutes in salted water.' });
  };

  it('answers with the cited sources, using the most relevant chunk first', async () => {
    await seed();
    const res = await request(app).post('/api/query').send({ question: 'How does postgres reclaim space from dead rows?' });

    assert.equal(res.status, 200);
    assert.equal(res.body.answer, 'Run VACUUM to reclaim space [1].');
    assert.equal(res.body.sources.length, 1);
    assert.equal(res.body.sources[0].n, 1);
    assert.equal(res.body.sources[0].title, 'Postgres');
    assert.match(res.body.sources[0].snippet, /VACUUM/);

    // The prompt got numbered context blocks, best match first.
    assert.match(calls.answer[0].context, /^\[1\] Postgres\n/);
  });

  it('respects topK', async () => {
    await seed();
    await request(app).post('/api/query').send({ question: 'postgres', topK: 1 });
    assert.doesNotMatch(calls.answer[0].context, /\[2\]/);
  });

  it('ignores citations that point at blocks that do not exist', async () => {
    ({ app } = createTestApp({ generateAnswer: async () => 'See [7] and [1].' }));
    await seed();
    const res = await request(app).post('/api/query').send({ question: 'postgres', topK: 2 });
    assert.deepEqual(res.body.sources.map((s) => s.n), [1]);
  });

  it('says the box is empty without calling the AI', async () => {
    const res = await request(app).post('/api/query').send({ question: 'anything?' });
    assert.equal(res.status, 200);
    assert.match(res.body.answer, /empty/);
    assert.deepEqual(res.body.sources, []);
    assert.equal(calls.answer.length, 0);
  });

  const invalidQueries = [
    ['missing question', {}],
    ['blank question', { question: '   ' }],
    ['topK out of range', { question: 'hi', topK: 0 }],
    ['non-integer topK', { question: 'hi', topK: 2.5 }],
  ];
  for (const [name, body] of invalidQueries) {
    it(`returns 400 for ${name}`, async () => {
      const res = await request(app).post('/api/query').send(body);
      assert.equal(res.status, 400);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    });
  }

  it('returns 502 with a readable message when the AI call fails', async () => {
    ({ app } = createTestApp({
      generateAnswer: async () => {
        throw new UpstreamError('Generating the answer failed: the AI model is overloaded right now, try again shortly');
      },
    }));
    await seed();
    const res = await request(app).post('/api/query').send({ question: 'postgres' });
    assert.equal(res.status, 502);
    assert.equal(res.body.error.code, 'UPSTREAM_ERROR');
    assert.match(res.body.error.message, /overloaded/);
  });
});

describe('unknown routes', () => {
  it('returns 404 in the standard error shape', async () => {
    const res = await request(app).get('/api/nope');
    assert.equal(res.status, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  });
});
