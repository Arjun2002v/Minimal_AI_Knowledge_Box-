// Structured JSON logger (pino). Pretty-printed when running in a terminal.
import { pino } from 'pino';

// NODE_TEST_CONTEXT is set by `node --test`, so test output stays clean.
const isTest = process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT !== undefined;
const level = process.env.LOG_LEVEL ?? (isTest ? 'silent' : 'info');

export const logger = pino({
  level,
  transport:
    process.stdout.isTTY && process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
});
