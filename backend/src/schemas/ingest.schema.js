import { z } from 'zod';

const MAX_NOTE_LENGTH = 100_000;

const noteSchema = z.object({
  type: z.literal('note'),
  content: z.string().trim().min(1, 'Note content is required').max(MAX_NOTE_LENGTH, 'Note is too long'),
  title: z.string().trim().max(200).optional(),
});

const urlSchema = z.object({
  type: z.literal('url'),
  url: z
    .string()
    .trim()
    .url('Must be a valid URL')
    .refine((value) => /^https?:\/\//i.test(value), 'Only http and https URLs are supported'),
});

export const ingestSchema = z.discriminatedUnion('type', [noteSchema, urlSchema], {
  error: "type must be 'note' or 'url'",
});
