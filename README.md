# Knowledge Box

A small app for saving notes and web links, then asking questions about them.

Answers come only from what you've saved. Each answer shows where it came from, with numbered links like `[1]` that jump to the matching text.

How it works, in short:
- When you save something, the text is cut into small pieces. Each piece is turned into a list of numbers (an "embedding") by Gemini and stored in SQLite.
- When you ask a question, the question gets turned into numbers too. The app finds the saved pieces closest to it and asks Gemini to answer using only those pieces.

The design choices and their downsides are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## What it's built with

- **Backend:** Node 22, Express 5, plain JavaScript. SQLite (built into Node), Zod to check requests, pino for logs.
- **AI parts:** LangChain JS with Google Gemini.
  - `gemini-embedding-001` turns text into numbers.
  - `gemini-3.5-flash-lite` writes the answers.
- **Frontend:** React 19, Vite, SWR for loading data, plain CSS.

## Running it

You need Node 22.5 or newer and a Gemini API key. A free key from https://aistudio.google.com/apikey is enough.

Open two terminals.

Terminal 1, the backend:

```bash
cd backend
npm install
cp .env.example .env      # then put your key in GEMINI_API_KEY
npm run dev               # runs on http://localhost:4000/api
```

Terminal 2, the frontend:

```bash
cd frontend
npm install
npm run dev               # open http://localhost:5173
```

Run these inside `backend` and `frontend`, not the project's top folder. The top folder has no `package.json`, so npm will fail there.

You don't need to compile anything or set up CORS. The frontend dev server passes `/api` requests on to the backend.

### Settings

All settings are in `backend/.env`. See [.env.example](backend/.env.example) for the full list. The ones you might change:

- `CHAT_MODEL`: try another Gemini Flash model if the default one is busy.
- `CHUNK_SIZE`, `CHUNK_OVERLAP`, `TOP_K`: how text is split and how many pieces are used per answer.
- `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`: if you change either one, delete `backend/data/inbox.db` and save your items again. Numbers from different models don't mix.

### Tests

```bash
cd backend
npm test
```

There are 37 tests. They check the API (bad input, status codes, saving, asking, citations) and the small helpers (splitting text, vector math, the prompt).

They use a temporary in-memory database and fake AI parts (`tests/helpers.js`), so they don't need internet or an API key.

## API

Every route starts with `/api`.

| Method | Path | Send | Get back |
|---|---|---|---|
| `POST` | `/ingest` | `{ "type": "note", "content": "...", "title"?: "..." }` or `{ "type": "url", "url": "https://..." }` | `201` with the saved `item` |
| `GET` | `/items` | nothing | `200` with your `items`, newest first, each with a short `preview` |
| `POST` | `/query` | `{ "question": "...", "topK"?: 1-20 }` | `200` with the `answer` and its `sources` |
| `GET` | `/health` | nothing | `200` `{ "status": "ok" }` |

Example answer from `/query`:

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

- `sources` only lists pieces the answer actually used.
- `n` is the number shown in the answer, like `[1]`.
- `score` is how close that piece was to the question, from 0 to 1.

If nothing you saved fits the question, the answer says so and `sources` is empty.

### Errors

Errors always look like this:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request body", "details": [{ "field": "url", "message": "Must be a valid URL" }] } }
```

| Status | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON` | What you sent is missing something or isn't valid JSON |
| 404 | `NOT_FOUND` | No such route |
| 413 | `PAYLOAD_TOO_LARGE` | What you sent is over 256 KB |
| 422 | `UNPROCESSABLE` | The link is valid, but the page can't be used: it errored, isn't a web page, has no text, is over 2 MB, or points at a private address |
| 502 | `UPSTREAM_ERROR` | The website or Gemini failed (timeout, rate limit, busy, wrong key). The message says which. |
| 500 | `INTERNAL_ERROR` | A bug in the app. Details go to the server log only. |

## Where things are

```
backend/src
  routes/      receive requests, check them, call a service, reply
  services/    the main steps: saving, listing, and answering questions
  db/          the SQLite database and all SQL
  rag/         splitting text, embeddings, search, the prompt, calling Gemini
  fetchers/    downloads a web page and pulls out its text
  middleware/  request checks, logging, turning errors into JSON
  config/      reads the .env file

frontend/src
  api/         calls the backend
  hooks/       load items, save items, ask questions
  components/  the parts of the page
```

`createApp()` gets the database and all the outside services (web fetching, Gemini) passed in. The real server passes the real ones, and the tests pass fakes.

In the browser, the item list is cached. When you save something, it's added to the top of the list right away without reloading. The list also refreshes when you come back to the tab.

## Why some things are the way they are

**Gemini instead of OpenAI.** Gemini has a free tier, so anyone can run this without paying. I use it through LangChain because that lets questions and saved text be embedded in slightly different ways, which gives better search results.

One problem: when Gemini fails during saving, LangChain doesn't report an error. It quietly returns empty results. The app checks for this, retries twice, and then shows a clear error instead of crashing.

**Web pages are downloaded by the server.** The browser usually isn't allowed to read other sites, and the server needs the text anyway. To stay safe, the server:
- gives up after 10 seconds or 2 MB
- only accepts web pages and plain text
- refuses links to your own computer or local network, and checks again after every redirect

It also strips out menus, headers, footers and scripts, and uses the main article area when a page has one.

**Answers must show their sources.** Gemini is told to put `[1]`, `[2]` and so on after each fact. The app removes any number that doesn't point to a real source, and the page turns the rest into links.

**Titles count in search.** A note's title is included when it's indexed, so a note titled "Remind me" is found when you ask about your reminder, even if the word isn't in the note itself.

**Notes get a title automatically.** If you leave the title empty, the first line of the note is used.

## Limits

- Only one user. There's no login.
- You can't edit or delete saved items.
- Saving the same link twice gives you two copies.
- Pages that need JavaScript to show their content come out mostly empty.
- Saving can be slow, and Gemini's free tier limits can make it fail.
- Don't save private things with a free key. Google may use what you send on the free tier to improve its products.
