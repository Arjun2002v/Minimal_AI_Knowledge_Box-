# Knowledge Box

A small personal knowledge inbox. You save notes and web links, and (in the next step) ask questions about them and get answers that cite where they came from.

Right now the save-and-list part is done end to end. The question-answering (RAG) part is the next piece of work. The Gemini client for it is already set up.

## Stack

- **Backend:** Node 22 and Express 5 in plain JavaScript (ES modules, with no build step), SQLite through Node's built-in `node:sqlite`, Zod for validation, pino for logs
- **Frontend:** React 19 and Vite in plain JavaScript (JSX), SWR for data fetching and caching, with plain CSS
- **AI (next step):** Google Gemini through its OpenAI-compatible endpoint (`gemini-3.5-flash-lite` for answers, `gemini-embedding-001` for embeddings)

## Running it

You need Node 22.5 or newer. The SQLite module is built into Node, so nothing has to compile.

```bash
# backend
cd backend
npm install
cp .env.example .env      # then put your Gemini key in .env
npm run dev               # http://localhost:4000/api

# frontend, in a second terminal
cd frontend
npm install
npm run dev               # http://localhost:5173
```

The Vite dev server proxies `/api` to the backend, so the browser only talks to one origin and there's no CORS setup.

Tests (backend):

```bash
cd backend
npm test
```

They use an in-memory database and a fake URL fetcher, so they don't need the network or an API key.

## API

All routes are under `/api`.

| Method | Path | What it does |
|---|---|---|
| `POST` | `/ingest` | Save a note `{ "type": "note", "content": "...", "title"?: "..." }` or a link `{ "type": "url", "url": "https://..." }`. Returns `201` and the saved item. |
| `GET` | `/items` | List saved items, newest first. Each one has a 200-character preview, not the full text. |
| `GET` | `/health` | Liveness check. |

Every error has the same shape, so the frontend only needs one way to handle errors:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request body", "details": [{ "field": "url", "message": "Must be a valid URL" }] } }
```

| Status | When |
|---|---|
| 400 | Invalid body or malformed JSON |
| 404 | Unknown route |
| 413 | Body over 256 KB |
| 422 | The URL was fine, but the page couldn't be used (404, not HTML, no text, too big, private address) |
| 502 | The remote site timed out or the connection failed |

## How it's put together

```
backend/src
  routes/      HTTP only: parse the request, call a service, send the response
  services/    the actual steps (fetch the page, build the item, save it)
  db/          SQL lives here and nowhere else
  fetchers/    downloads a URL and extracts its readable text
  middleware/  validation, request logging, error → JSON mapping
  rag/         Gemini client, embeddings, chat (wired up in the next step)

frontend/src
  api/         a fetch wrapper that turns error responses into an ApiError
  hooks/       useItems (useSWR) and useIngest (useSWRMutation)
  components/  IngestForm, ItemList, ErrorBanner
```

`createApp()` takes its dependencies (the database and the URL fetcher) as arguments and doesn't start listening. That's what lets the tests create an app with an in-memory database.

On the frontend, the items list is cached by SWR under the `/items` key. After a save, `useSWRMutation` puts the new item at the top of that cached list itself (`populateCache`), so the list updates without fetching everything again. SWR also refetches when you come back to the tab, and it retries network and server errors but not 4xx responses.

## Decisions worth explaining

**SQLite instead of Postgres or a vector database.** For a single-user tool it's one file, needs no setup, and is fast enough. I started with `better-sqlite3`, but its native binary crashed on my Windows machine, so I switched to `node:sqlite`. It needs no build step, so anyone can clone the project and run it. The tradeoff is that it's still experimental in Node 22, which is why the npm scripts pass `--experimental-sqlite`.

**Fetching URLs on the server.** The browser can't read most pages because of CORS, and the RAG step needs the text on the server anyway. Because the server is fetching user-supplied URLs, I added some guards:
- a 10-second timeout and a 2 MB size cap
- only HTML or plain text is accepted
- addresses that resolve to localhost or private networks are rejected, and this is re-checked on every redirect (redirects are followed manually)

Text extraction is simple. It removes scripts, nav, header, footer and similar parts, and prefers `<article>` or `<main>` when the page has one. It works fine on blogs and docs, but less well on pages that build their content with JavaScript.

**Notes get a title automatically.** If you don't give one, the title is the first line of the note, cut at a word boundary.

**Previews are cut in SQL.** `GET /items` uses `substr()`, so a long article's full text never leaves the database just to show a list.

## What's next

1. **Chunking.** Split each item into overlapping chunks along paragraph and sentence boundaries.
2. **Embeddings.** Embed the chunks with Gemini and store the vectors as BLOBs next to the chunks.
3. **`POST /query`.** Embed the question, find the closest chunks by cosine similarity, send them to Gemini as numbered context, and return the answer with `[n]` citations mapped back to their source items.
4. **The Ask panel** in the UI, showing the answer and the source snippets.

## Known limitations

- No auth, and it's single user.
- No deleting or editing items yet.
- Saving the same URL twice creates two items.
- Pages that need JavaScript to show their content come out mostly empty.
