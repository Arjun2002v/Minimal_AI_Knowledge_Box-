import { pino } from 'pino';

// Keep logs quiet during `node --test`.
const isTest = process.env.NODE_ENV === 'test' || process.env.NODE_TEST_CONTEXT !== undefined;
const level = process.env.LOG_LEVEL ?? (isTest ? 'silent' : 'info');

export const logger = pino({
  level,
  transport:
    process.stdout.isTTY && process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined,
});
