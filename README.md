# Knowledge Box

A small personal knowledge inbox. You save notes and web links, then ask questions about them. The answers use only what you've saved, and each claim links to the passage it came from.

It's a basic RAG setup:
- **Saving:** content is split into chunks, the chunks are embedded with Gemini, and the vectors are stored in SQLite.
- **Asking:** the question is embedded, the closest chunks are found, and Gemini writes an answer from only those chunks, citing them as `[1]`, `[2]`, and so on.

The tradeoffs (chunking, vector store, what breaks at scale, production changes) are written up in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack

- **Backend:**
  - Node 22 and Express 5 in plain JavaScript (ES modules, no build step)
  - SQLite through Node's built-in `node:sqlite`
  - Zod for validation, pino for logs
- **RAG:** LangChain JS
  - `@langchain/textsplitters` splits the text into chunks
  - `@langchain/google-genai` provides the Gemini embeddings and chat model
  - `@langchain/core` provides the prompt template and the chain
- **Models:**
  - `gemini-embedding-001` for embeddings, at 768 dimensions
  - `gemini-3.5-flash-lite` for answers
- **Frontend:** React 19 and Vite in plain JavaScript (JSX), SWR for data fetching and caching, plain CSS

## Running it

You need **Node 22.5 or newer** and a **Gemini API key**. The free one from https://aistudio.google.com/apikey works.

```bash
# backend
cd backend
npm install
cp .env.example .env      # then set GEMINI_API_KEY in .env
npm run dev               # http://localhost:4000/api

# frontend, in a second terminal
cd frontend
npm install
npm run dev               # http://localhost:5173
```

**Notes:**
- **Nothing to compile.** The SQLite module is built into Node. It's still marked experimental in Node 22, so the npm scripts pass `--experimental-sqlite`.
- **No CORS setup.** The Vite dev server forwards `/api` to the backend, so the browser only talks to one origin.

All settings live in `backend/.env`; see [.env.example](backend/.env.example). The ones you're most likely to change:
- **`CHAT_MODEL`:** if the default model is overloaded, try another Gemini Flash model.
- **`CHUNK_SIZE`, `CHUNK_OVERLAP` and `TOP_K`:** chunking and retrieval settings.
- **`EMBEDDING_MODEL` or `EMBEDDING_DIMENSIONS`:** if you change either, delete `backend/data/inbox.db` and save your items again. Vectors from different models can't be compared.

### Tests

```bash
cd backend
npm test
```

There are 36 tests, using Node's built-in test runner:
- **API tests:** validation, status codes, ingestion, querying and citations.
- **Unit tests:** the chunker, the vector helpers and the prompt helpers.

They use an in-memory database and a fake embedder, fetcher and model (`tests/helpers.js`), so they don't need the network or an API key.

## API

All routes are under `/api`.

| Method | Path | Body | Response |
|---|---|---|---|
| `POST` | `/ingest` | `{ "type": "note", "content": "...", "title"?: "..." }` or `{ "type": "url", "url": "https://..." }` | `201` `{ item }` (includes `chunkCount`) |
| `GET` | `/items` | | `200` `{ items }`, newest first, each with a 200-character `preview` |
| `POST` | `/query` | `{ "question": "...", "topK"?: 1-20 }` | `200` `{ answer, sources }` |
| `GET` | `/health` | | `200` `{ status: "ok" }` |

Example `/query` response:

```json
{
  "answer": "The Q3 offsite is in Lisbon, and the budget is 900 EUR per person, hotel included [1].",
  "sources": [
    {
      "n": 1,
      "itemId": "e2f8707c-…",
      "title": "Team offsite",
      "url": null,
      "type": "note",
      "snippet": "The Q3 offsite is in Lisbon from 14 to 16 October. …",
      "score": 0.789
    }
  ]
}
```

What the fields mean:
- **`sources`** lists only the chunks the answer actually cites.
- **`n`** matches the `[n]` marker in the answer.
- **`score`** is the cosine similarity between the question and that chunk.

If nothing relevant is saved, the answer says so and `sources` is empty.

### Errors

Every error has the same shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request body", "details": [{ "field": "url", "message": "Must be a valid URL" }] } }
```

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON` | Invalid body or malformed JSON |
| 404 | `NOT_FOUND` | Unknown route |
| 413 | `PAYLOAD_TOO_LARGE` | Body over 256 KB |
| 422 | `UNPROCESSABLE` | The URL was fine, but the page couldn't be used (HTTP error, not HTML, no text, over 2 MB, private address) |
| 502 | `UPSTREAM_ERROR` | The remote site timed out or failed, or Gemini failed (rate limit, overload, bad key). The message says which. |
| 500 | `INTERNAL_ERROR` | A bug. The details go to the log, not to the client. |

## How it's put together

```
backend/src
  routes/      HTTP only: validate, call a service, send the response
  services/    ingestion (fetch → chunk → embed → save), items, rag (embed → search → prompt → answer)
  db/          SQLite connection, schema, and the only place with SQL (items + chunks repositories)
  rag/         chunker, embeddings, retriever, prompt, llm (LangChain + Gemini), vector helpers
  fetchers/    downloads a URL and extracts its readable text
  middleware/  validation, request logging, error → JSON mapping
  config/      reads and validates .env

frontend/src
  api/         fetch wrapper; turns error responses into an ApiError
  hooks/       useItems (useSWR), useIngest and useAsk (useSWRMutation)
  components/  IngestForm, ItemList, AskPanel, AnswerView, SourceSnippet, ErrorBanner
```

`createApp()` receives everything from outside as arguments: the database, the URL fetcher, the chunker, the embedder and the answer generator. `server.js` passes in the real ones and the tests pass in fakes. Nothing else in the app knows which one it got.

On the frontend, SWR caches the items list under the `/items` key. After a save, `useSWRMutation` puts the new item at the top of that cached list itself, so there's no refetch. SWR also refetches when you come back to the tab, and it retries network and server errors but not 4xx responses.

## Decisions worth explaining

These are the decisions not covered in ARCHITECTURE.md.

**Gemini through LangChain.** The brief asks for OpenAI or an equivalent. Gemini has a free tier, which is easier for a reviewer to run.

I tried calling Gemini through its OpenAI-compatible endpoint first. I switched to LangChain's native Gemini integration because it supports separate task types for documents and questions, which improves retrieval.

LangChain has one catch: when a batch embedding request fails, `embedDocuments` doesn't throw. It returns empty vectors instead. `rag/embeddings.js` checks every vector, retries twice, and then returns a clear 502. Before that check, a rate-limited save caused a confusing 500 from SQLite.

**Fetching URLs on the server.** The browser can't read most pages because of CORS, and the text has to be on the server to be embedded anyway. The fetcher has these guards:
- a 10-second timeout and a 2 MB cap
- only HTML or plain text is accepted
- addresses that resolve to localhost or private networks are rejected, and this is re-checked on every redirect (redirects are followed manually)

Text extraction removes scripts, nav, header, footer and similar parts, and prefers `<article>` or `<main>` when the page has one.

**Answers must cite, and citations are checked.** The prompt numbers the context blocks and asks for `[n]` after every claim. The server keeps only citations that point at blocks that really exist. The UI turns them into links that jump to the source snippet.

**Notes get a title automatically.** If you don't give one, the title is the first line of the note, cut at a word boundary.

## Known limitations

- **Single user.** There's no auth.
- **Items can't be edited or deleted** from the UI or the API.
- **Duplicates aren't detected.** Saving the same URL twice creates two items.
- **JavaScript-heavy pages don't work.** Pages that need JavaScript to show their content come out mostly empty.
- **Saving can be slow.** It waits for the page download and for Gemini embeddings inside the request, and the free tier's rate limits can make it fail with a 502.
- **Don't save anything sensitive on a free key.** On Gemini's free tier, Google may use what you send to improve its products.
