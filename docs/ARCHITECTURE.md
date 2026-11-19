# How It Works and Why

## What happens on each request

### Saving something (`POST /api/ingest`)

1. The request is checked. If something's wrong, the app replies with a 400 and stops.
2. If it's a link, the server downloads the page and pulls out the readable text (`fetchers/url-fetcher.js`).
3. The text is cut into pieces called chunks (`rag/chunker.js`).
4. Each chunk, together with the item's title, is sent to Gemini in one batch and turned into numbers (`rag/embeddings.js`).
5. The item and its chunks are saved to SQLite in one step.

Gemini is called before anything is saved. If Gemini fails, nothing is saved, so you never end up with half an item.

### Asking a question (`POST /api/query`)

1. The question is turned into numbers.
2. Every saved chunk is compared with the question, and the 5 closest are kept (`rag/retriever.js`).
3. Those chunks are numbered and put into the prompt as `[1] Title`, then the text (`rag/prompt.js`).
4. Gemini writes the answer (`rag/llm.js`).
5. The app reads the `[1]`, `[2]` numbers in the answer and sends back only the chunks that were actually used.

If nothing has been saved yet, the app says so and doesn't call Gemini.

## How text is split

I use LangChain's `RecursiveCharacterTextSplitter`:
- Chunks are about 800 characters long.
- Each chunk repeats the last 150 characters of the previous one.
- It tries to split at paragraphs first, then lines, then sentences, then spaces. It only cuts in the middle of a word if the text has no spaces at all.

**Why 800 characters.** That's usually one idea, about a paragraph. Small enough that search matches the question to something specific, big enough to keep some context. Five of them per question is about 4,000 characters, which is cheap and gives Gemini little to get confused by.

**Why the 150-character overlap.** If a fact sits right where two chunks meet, it still appears whole in one of them. It costs about 20% more chunks.

**Why count characters and not tokens.** It's simpler and needs no extra library. Gemini accepts much longer text than 800 characters, so there's no risk of going over its limit.

**Questions and saved text are embedded differently.** Gemini has one mode for saved text and another for questions. They're made to match each other, which usually finds better results than using the same mode for both.

**Weak spots:**
- A chunk from the middle of a long article doesn't know which heading it was under. It only knows the page title.
- The split doesn't follow topics. That would need an extra Gemini call per item.
- LangChain sometimes puts a full stop at the start of the next chunk, like `". Next sentence"`. The app removes it, so the earlier chunk loses its full stop. This doesn't affect search.

## Where the numbers are stored

The numbers live in SQLite next to everything else, and search is done in plain JavaScript. There's no separate vector database.

- Each chunk row stores its 768 numbers as raw bytes, about 3 KB per chunk.
- The numbers are scaled when saved so that comparing two chunks is a simple multiplication and sum.
- Each search loads every chunk, scores it, and keeps the best 5.

**Why:**
- **One file, nothing else to run.** You run `npm install` and `npm run dev`, and that's it.
- **Items and their numbers can't get out of sync.** They're saved together, and deleting an item deletes its chunks.
- **Checking every chunk is exact and fast enough here.** It always finds the real best matches, and there's nothing to tune.
- **768 numbers instead of 3,072.** Gemini's embedding model is built so a shorter list keeps most of its quality. It takes a quarter of the space and searches four times faster.

Search speed on my machine (best 5 out of N chunks):

| Chunks | Search time | Memory |
|---|---|---|
| 1,000 | ~9 ms | ~13 MB |
| 10,000 | ~100 ms | ~29 MB |
| 50,000 | ~780 ms | ~109 MB |

A personal collection of a few hundred pages is a few thousand chunks, so search takes under 50 ms. The Gemini call (1 to 3 seconds) is what you actually wait for.

**What I didn't use, and why:**
- **`sqlite-vec`** needs to be compiled, which caused trouble on Windows before.
- **pgvector** needs a Postgres server.
- **Chroma or Pinecone** are another service to run and keep in sync.
- **LangChain's in-memory store** loses everything when the server restarts.

## What breaks as it grows

Roughly in the order you'd hit them:

1. **Search gets slower with every chunk.** Every question checks every chunk. Past 20,000 to 50,000 chunks it takes hundreds of milliseconds, and the server can't handle other requests while it runs.
2. **Saving happens while you wait.** A long page means a big Gemini request. If Gemini is rate-limited, the save fails instead of being retried later. You can't import lots of items at once.
3. **Gemini limits and outages.** Every save and every question calls Gemini. There's no queue and no backup provider. During testing, the bigger Gemini models often replied "too busy", which is why the default is `flash-lite`.
4. **Changing the embedding model.** The database doesn't record which model made each chunk's numbers. If you change the model, old numbers stop making sense and everything has to be saved again.
5. **SQLite takes one write at a time.** Fine for one person. Many people saving at once would have to wait in line.
6. **Search misses exact words.** Number-based search can miss exact things like error codes, names or IDs. And the 5 closest chunks are always sent to Gemini, even if none of them fits. The prompt tells Gemini to say "not found" then, but that depends on Gemini following it.
7. **Web pages can contain tricks.** A page could include text meant to give Gemini instructions. The prompt treats saved text as data, but that's not a guarantee.

## What I'd change for real users

- **A proper search index.** Postgres with pgvector (which also fixes the one-write-at-a-time limit), or `sqlite-vec` if it stays single-user. Until then, loading the numbers into memory once at startup would avoid reading them from disk on every question.
- **Mix in keyword search.** Combine normal text search with number-based search so exact words are found. Skip chunks below a minimum score.
- **Save in the background.** Reply right away with "processing", and let a separate worker download, split and embed, with retries.
- **Record which model made each chunk's numbers**, so old ones can be rebuilt after a model change.
- **Handle Gemini problems better.** A paid plan, limits per user, caching repeated questions, a backup model, and streaming answers as they're written.
- **Measure answer quality.** Keep a set of questions with known answers and check them after every change, instead of guessing.
- **Better monitoring.** Track how long each step takes, how often Gemini fails, and how much it's used.
- **Security.**
  - A login once there's more than one user.
  - Close a gap where a link could pass the "no local network" check and then point somewhere else when it's actually downloaded.
  - Flag text in saved pages that looks like instructions to the AI.

## Finding problems

- **Every request is logged on one line** with an id, the method, the path, the status and how long it took. The same id is sent back in the `x-request-id` header, so a user's error can be found in the log.
- **Every question logs what search found:** which chunks, their scores, and which ones the answer used. When an answer is wrong, check this first. Did search miss the right chunk, or did Gemini ignore it?
- **When Gemini or a website fails, the full original error is logged**, but the user only sees a short, clear message.
- **Every error has the same shape:** `{ error: { code, message, details? } }`. The README lists the status codes.
