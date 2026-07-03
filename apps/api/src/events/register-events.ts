import { MESSAGE_SENT_EVENT, domainEvents, type MessageSentEventPayload } from "./domain-events.js";
import { notificationProcessor } from "../processors/notification.processor.js";

export function registerDomainEventHandlers() {
  domainEvents.on(MESSAGE_SENT_EVENT, (payload: MessageSentEventPayload) => {
    void notificationProcessor.handleMessageSent(payload).catch((error) => {
      console.error("NotificationProcessor failed", error);
    });
  });
}
