import { EventEmitter } from "node:events";

export const domainEvents = new EventEmitter();

export const MESSAGE_SENT_EVENT = "message.sent";
export const MESSAGE_REPLY_CREATED_EVENT = "message.reply.created";

export type MessageSentEventPayload = {
  messageId: string;
  recipientIds: string[];
  sentAt: Date;
};

export type MessageReplyCreatedEventPayload = {
  replyId: string;
  messageId: string;
  messageRecipientId: string;
  createdAt: Date;
};
