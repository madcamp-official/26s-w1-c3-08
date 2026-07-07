import {
  MESSAGE_REPLY_CREATED_EVENT,
  MESSAGE_SENT_EVENT,
  domainEvents,
  type MessageReplyCreatedEventPayload,
  type MessageSentEventPayload,
} from "./domain-events.js";
import { notificationProcessor } from "../processors/notification.processor.js";

export function registerDomainEventHandlers() {
  domainEvents.on(MESSAGE_SENT_EVENT, (payload: MessageSentEventPayload) => {
    void notificationProcessor.handleMessageSent(payload).catch((error) => {
      console.error("NotificationProcessor failed", error);
    });
  });

  domainEvents.on(MESSAGE_REPLY_CREATED_EVENT, (payload: MessageReplyCreatedEventPayload) => {
    void notificationProcessor.handleReplyCreated(payload).catch((error) => {
      console.error("Reply notification failed", error);
    });
  });
}
