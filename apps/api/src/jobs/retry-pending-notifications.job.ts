import { notificationProcessor } from "../processors/notification.processor.js";

let running = false;

export async function retryPendingNotifications() {
  if (running) {
    return { processed: 0 };
  }

  running = true;

  try {
    return await notificationProcessor.retryPendingNotifications();
  } finally {
    running = false;
  }
}
