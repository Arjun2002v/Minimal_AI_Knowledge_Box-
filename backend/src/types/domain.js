// Shapes of the data passed around the backend (JSDoc only, no runtime code).

/** @typedef {'note' | 'url'} SourceType */

/**
 * A saved note or web page.
 * @typedef {object} Item
 * @property {string} id
 * @property {SourceType} type
 * @property {string} title
 * @property {string | null} url
 * @property {string} content
 * @property {string} createdAt  ISO timestamp
 */

/**
 * What GET /items returns: everything except the full content.
 * @typedef {object} ItemSummary
 * @property {string} id
 * @property {SourceType} type
 * @property {string} title
 * @property {string | null} url
 * @property {string} preview
 * @property {string} createdAt
 * @property {number} [chunkCount]  only in the POST /ingest response
 */

/**
 * A piece of an item's text with its embedding (rows of the `chunks` table).
 * @typedef {object} Chunk
 * @property {string} itemId
 * @property {number} position  0-based order inside the item
 * @property {string} text
 * @property {Float32Array} embedding  L2-normalized
 */

/**
 * One cited source in a POST /query response. `n` matches the [n] marker in the answer.
 * @typedef {object} Source
 * @property {number} n
 * @property {string} itemId
 * @property {string} title
 * @property {string | null} url
 * @property {SourceType} type
 * @property {string} snippet  the chunk text that was retrieved
 * @property {number} score    cosine similarity to the question
 */

/**
 * @typedef {object} QueryResult
 * @property {string} answer
 * @property {Source[]} sources
 */

export {};
