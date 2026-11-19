import { z } from 'zod';

export const querySchema = z.object({
  question: z.string().trim().min(1, 'Question is required').max(1000, 'Question is too long (max 1000 characters)'),
  topK: z.number().int().min(1).max(20).optional(),
});
