// Reads and validates environment variables (API keys, model names, chunk sizes, DB path).
import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z
  .object({
    GEMINI_API_KEY: z.string().min(1, 'GEMINI_API_KEY is required (get one at https://aistudio.google.com/apikey)'),
    LLM_BASE_URL: z.string().url().default('https://generativelanguage.googleapis.com/v1beta/openai/'),
    CHAT_MODEL: z.string().min(1).default('gemini-3.5-flash-lite'),
    EMBEDDING_MODEL: z.string().min(1).default('gemini-embedding-001'),
    EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(768),

    PORT: z.coerce.number().int().positive().default(4000),
    DB_PATH: z.string().min(1).default('./data/inbox.db'),
    CHUNK_SIZE: z.coerce.number().int().positive().default(800),
    CHUNK_OVERLAP: z.coerce.number().int().nonnegative().default(150),
    TOP_K: z.coerce.number().int().positive().default(5),
  })
  .refine((e) => e.CHUNK_OVERLAP < e.CHUNK_SIZE, {
    message: 'CHUNK_OVERLAP must be smaller than CHUNK_SIZE',
    path: ['CHUNK_OVERLAP'],
  });

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;
