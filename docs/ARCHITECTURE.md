# Architecture & Tradeoffs

## How a request flows

**Saving (`POST /api/ingest`)**

1. Zod validates the body. A bad body stops here with a 400.
2. For a URL, the server downloads the page and pulls out the readable text (`fetchers/url-fetcher.js`).
3. The text is split into chunks (`rag/chunker.js`).
4. All the chunks are embedded with Gemini in one batched call (`rag/embeddings.js`).
5. The item and its chunks are written in one SQLite transaction.

Embedding happens before anything is written. If Gemini fails, nothing is saved, so an item can't exist without its chunks.

**Asking (`POST /api/query`)**

1. The question is embedded.
2. Every stored chunk is scored against it (`rag/retriever.js`), and the top K (default 5) are kept.
3. Those chunks become numbered context blocks, `[1] Title (url)\n text…` (`rag/prompt.js`).
4. A LangChain chain (prompt → Gemini → string) writes the answer (`rag/llm.js`).
5. The `[n]` markers in the answer are matched back to the blocks. Only blocks the model actually cited come back as `sources`.

If the box is empty, the API says so and never calls Gemini.

## Chunking approach

I use LangChain's `RecursiveCharacterTextSplitter`:
- **Size:** 800 characters per chunk, with a 150-character overlap.
- **Separators, tried in order:** paragraph (`\n\n`), line, sentence end (`. `, `? `, `! `), space, and finally single characters.

The splitter only falls back to a smaller separator for a piece that's still too long. So most chunks end at a paragraph or sentence boundary, and a hard cut mid-word only happens when the text has no spaces at all.

**Why around 800 characters (roughly 150–200 tokens).** A chunk that size usually holds a single idea, so the question's embedding gets compared with something focused rather than a whole page's average. It's still big enough to carry the surrounding context. With top-5 retrieval, that's about 4,000 characters of context per question, which is cheap and leaves the model little irrelevant text to get distracted by.

**Why 150 characters of overlap.** A fact that sits across a chunk boundary still shows up whole in at least one chunk. The cost is about 20% more chunks to embed and store.

**Why characters and not tokens.** Counting characters needs no tokenizer dependency and is easy to reason about. The embedding model accepts far more than 800 characters, so there's no risk of going over its input limit.

**Different task types for documents and questions.** Chunks are embedded with Gemini's `RETRIEVAL_DOCUMENT` task type and questions with `RETRIEVAL_QUERY`. Gemini trains these two to match each other, which usually beats embedding both the same way.

**Known weaknesses:**
- **Section headings aren't carried along.** A chunk from the middle of a long article doesn't know which heading it was under.
- **No semantic chunking.** Splitting by topic would cost an extra model call per document.
- **A small quirk from LangChain.** The splitter attaches the sentence separator to the start of the next chunk, giving chunks like `". Next sentence"`. The wrapper strips that leading punctuation, which means the previous chunk ends without its full stop. That's harmless for retrieval.

## Vector store choice

I store vectors in SQLite and search them in plain JavaScript. There's no vector database.

**How the vectors are stored:**
- Each chunk row holds its embedding as a `BLOB` of raw `Float32` values.
- Each vector has 768 dimensions, about 3 KB per chunk.
- Vectors are scaled to length 1 when they're written, so cosine similarity is just a dot product.
- A search loads every chunk, scores it and keeps the best K.

**Why:**
- **One file, no extra service.** The reviewer runs `npm install` and `npm run dev`, and nothing else.
- **Vectors live next to the data they belong to.** An item and its chunks are saved in one transaction, and deleting an item removes its chunks (`ON DELETE CASCADE`). With a separate vector store, those two could get out of sync.
- **Brute force is accurate and fast enough at this size.** It always finds the true nearest chunks, unlike approximate indexes, and there's nothing to tune.
- **768 dimensions instead of the default 3072.** `gemini-embedding-001` is trained so a shortened vector keeps most of its quality (Matryoshka representation learning). The shorter vectors take a quarter of the storage, and search is four times faster.

I measured search on my machine with random 768-dimension vectors (top 5):

| Chunks | Search time | Node heap |
|---|---|---|
| 1,000 | ~9 ms | ~13 MB |
| 10,000 | ~100 ms | ~29 MB |
| 50,000 | ~780 ms | ~109 MB |

A personal inbox of a few hundred saved pages is a few thousand chunks, so search takes well under 50 ms. The Gemini call (1–3 s) is what the user actually waits for.

**Alternatives I didn't pick:**
- **`sqlite-vec`:** a native extension. It needs a native build, which is the kind of problem that already ruled out `better-sqlite3` on Windows.
- **pgvector:** adds a database server to run.
- **Chroma or Pinecone:** another service, plus keeping two stores in sync.
- **LangChain's `MemoryVectorStore`:** loses everything on restart.

## What breaks at scale

Roughly in the order they'd show up:

1. **Search time grows linearly.** Every query reads and scores every chunk. Past roughly 20–50k chunks, the search itself takes hundreds of milliseconds. It also blocks Node's event loop while it runs, so other requests wait.
2. **Ingestion happens inside the request.** A long page means a large embedding batch, and the user waits for the download plus the embedding. Gemini rate limits (especially on the free tier) turn into 502s on save instead of a retry later. Bulk imports aren't possible.
3. **Rate limits and outages.** Each save and each question calls Gemini. There's no request queue, no backoff across requests (only per call) and no fallback provider. During testing, the bigger Flash models were returning 503 "high demand", which is why the default chat model is `flash-lite`.
4. **Changing the embedding model.** Chunks don't record which model or dimension created them. Changing `EMBEDDING_MODEL` or `EMBEDDING_DIMENSIONS` quietly makes old vectors meaningless, and everything has to be re-embedded.
5. **SQLite allows one writer at a time.** Fine for one user. Many users saving at once would queue behind each other (WAL mode helps reads, not writes).
6. **Retrieval quality on large, mixed collections.** Pure vector search misses exact terms like error codes, names or IDs. And with no minimum similarity, the top 5 chunks are always sent to the model, even when none of them is relevant. The prompt tells the model to say "not found" in that case, but that relies on the model following the instruction.
7. **Fetched pages are untrusted text.** A page can contain instructions aimed at the model (prompt injection). The system prompt treats the context as data, but that isn't a guarantee.

## Production changes

What I'd change first if this had real users:

- **Use a real vector index.** Either pgvector with an HNSW index (Postgres also fixes the single-writer limit), or `sqlite-vec` if staying single-user. In the meantime, keeping the vectors in memory at startup would avoid reading them from SQLite on every query.
- **Hybrid search.** Combine SQLite FTS5 or Postgres full-text search (BM25) with vector search to catch exact terms. Add a minimum score threshold, and optionally a reranker over the top 20.
- **Move ingestion into a background job queue.** `POST /ingest` would return `202` with the item id right away, and a worker would download, chunk and embed with retries and backoff. The UI would show "processing" until the item is ready.
- **Record the embedding model and dimension on each chunk.** Then a re-embed job can rebuild old vectors when the model changes.
- **Make the AI layer more resilient.** Use a paid tier, add per-user rate limiting on `/query`, cache embeddings of repeated questions, add a fallback model, and stream answers to the UI.
- **Measure quality.** Build a small set of questions with known answers and track retrieval hit rate and whether answers are grounded, so changes to chunking or the prompt can be compared instead of guessed.
- **Observability.** Request logs already carry a request id. I'd add metrics for latency per step (embed, search, generate), Gemini error rates and token usage, plus tracing.
- **Security basics.**
  - Auth once there's more than one user.
  - Re-check the resolved IP inside the fetch's own connection. Right now the check and the fetch resolve DNS separately, which leaves a DNS-rebinding gap.
  - Strip or flag instruction-like text in fetched pages.

## Debuggability

- **Structured JSON logs (pino).** Every request gets one line with `requestId`, method, path, status and duration. The id is returned in the `x-request-id` response header, so a user-reported error can be found in the logs.
- **Every RAG query logs what was retrieved.** That's the item id, position and score of each chunk, plus which blocks the answer cited. This is the first thing to check when an answer is wrong: did search find the right chunk, or did the model ignore it?
- **Upstream failures are logged with the original provider error** (`cause`), but the client only gets a clean message.
- **One error shape for every endpoint:** `{ error: { code, message, details? } }`, with the status codes listed in the README.
