import { EventEmitter } from "node:events";

export const domainEvents = new EventEmitter();

export const MESSAGE_SENT_EVENT = "message.sent";

export type MessageSentEventPayload = {
  messageId: string;
  recipientIds: string[];
  sentAt: Date;
};
