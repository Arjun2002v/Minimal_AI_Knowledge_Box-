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
 */

export {};
