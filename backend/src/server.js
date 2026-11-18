// Entry point: loads config, opens DB, starts the HTTP server.
import { createApp } from './app.js';
import { env } from './config/env.js';
import { openDb } from './db/client.js';
import { fetchUrl } from './fetchers/url-fetcher.js';
import { logger } from './lib/logger.js';

const db = openDb(env.DB_PATH);
const app = createApp({ db, fetchUrl });

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}/api`);
});

const shutdown = (signal) => {
  logger.info(`${signal} received, shutting down`);
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
