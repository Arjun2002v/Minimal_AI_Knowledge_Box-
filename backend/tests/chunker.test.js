import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createChunker } from '../src/rag/chunker.js';
import { citedBlockNumbers, formatContext } from '../src/rag/prompt.js';
import { dot, fromBlob, normalize, toBlob } from '../src/rag/vectors.js';

const chunk = createChunker({ chunkSize: 100, chunkOverlap: 20 });

describe('chunker', () => {
  it('returns no chunks for empty or whitespace-only text', async () => {
    assert.deepEqual(await chunk(''), []);
    assert.deepEqual(await chunk('   \n\n  '), []);
  });

  it('keeps short text as a single chunk', async () => {
    assert.deepEqual(await chunk('  A short note.  '), ['A short note.']);
  });

  it('never produces a chunk longer than chunkSize', async () => {
    const text = Array.from({ length: 30 }, (_, i) => `This is sentence ${i}.`).join(' ');
    const chunks = await chunk(text);
    assert.ok(chunks.length > 1);
    for (const c of chunks) assert.ok(c.length <= 100, `chunk too long: ${c.length}`);
  });

  it('prefers paragraph boundaries', async () => {
    const chunks = await chunk(`${'a '.repeat(30).trim()}\n\n${'b '.repeat(30).trim()}`);
    assert.equal(chunks.length, 2);
    assert.match(chunks[0], /^a( a)*$/);
    assert.match(chunks[1], /^b( b)*$/);
  });

  it('does not start a chunk with leftover sentence punctuation', async () => {
    const text = Array.from({ length: 20 }, (_, i) => `Sentence ${i} is here`).join('. ');
    for (const c of await chunk(text)) assert.doesNotMatch(c, /^[.?!]/);
  });

  it('overlaps consecutive chunks', async () => {
    const words = Array.from({ length: 60 }, (_, i) => `w${i}`);
    const chunks = await chunk(words.join(' '));
    const lastWordOfFirst = chunks[0].split(' ').at(-1);
    assert.ok(chunks[1].split(' ').includes(lastWordOfFirst), 'second chunk should repeat the end of the first');
  });

  it('handles text with no punctuation or spaces by hard-splitting', async () => {
    const chunks = await chunk('x'.repeat(250));
    assert.ok(chunks.length >= 3);
    for (const c of chunks) assert.ok(c.length <= 100);
  });

  it('rejects an overlap that is not smaller than the chunk size', () => {
    assert.throws(() => createChunker({ chunkSize: 100, chunkOverlap: 100 }));
  });
});

describe('vectors', () => {
  it('normalizes to unit length so dot product = cosine similarity', () => {
    const v = normalize([3, 4]);
    assert.ok(Math.abs(dot(v, v) - 1) < 1e-6);
    assert.ok(Math.abs(v[0] - 0.6) < 1e-6);
  });

  it('round-trips through a BLOB', () => {
    const v = normalize([1, 2, 3]);
    assert.deepEqual(Array.from(fromBlob(toBlob(v))), Array.from(v));
  });
});

describe('prompt helpers', () => {
  it('numbers context blocks from 1 and includes the URL when there is one', () => {
    const context = formatContext([
      { title: 'A', url: null, text: 'first' },
      { title: 'B', url: 'https://b.example', text: 'second' },
    ]);
    assert.equal(context, '[1] A\nfirst\n\n[2] B (https://b.example)\nsecond');
  });

  it('extracts cited block numbers, including "[1, 3]" style, ignoring unknown ones', () => {
    assert.deepEqual(citedBlockNumbers('Yes [2]. Also [1, 3] and [9].', 3), [1, 2, 3]);
    assert.deepEqual(citedBlockNumbers('No citations here.', 3), []);
  });
});
