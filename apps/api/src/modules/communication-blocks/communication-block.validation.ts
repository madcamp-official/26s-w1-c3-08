import { z } from "zod";

export const communicationBlockDirectionSchema = z.enum(["SEND_TO", "RECEIVE_FROM"]);

export const createCommunicationBlockSchema = z.object({
  direction: communicationBlockDirectionSchema,
  target: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("USER"),
      userId: z.string().uuid(),
    }),
    z.object({
      type: z.literal("EMAIL"),
      value: z.string().trim().email().max(255),
      label: z.string().trim().max(80).optional().or(z.literal("")),
    }),
    z.object({
      type: z.literal("PHONE"),
      value: z.string().trim().max(32),
      label: z.string().trim().max(80).optional().or(z.literal("")),
    }),
  ]),
});

export type CreateCommunicationBlockInput = z.infer<typeof createCommunicationBlockSchema>;
export type CommunicationBlockDirectionInput = z.infer<typeof communicationBlockDirectionSchema>;
