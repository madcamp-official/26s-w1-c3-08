import { z } from "zod";

export const createMessageCollectionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  scheduledAt: z.string().datetime(),
});

export const createMessageCollectionSubmissionSchema = z.object({
  senderDisplayName: z.string().trim().max(80).optional().or(z.literal("")),
  content: z.string().trim().min(1).max(2000),
});

export type CreateMessageCollectionInput = z.infer<typeof createMessageCollectionSchema>;
export type CreateMessageCollectionSubmissionInput = z.infer<typeof createMessageCollectionSubmissionSchema>;
