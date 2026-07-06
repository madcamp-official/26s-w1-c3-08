import { notificationProcessor } from "../processors/notification.processor.js";

let running = false;

export async function sendArrivalHints() {
  if (running) {
    return { processed: 0 };
  }

  running = true;

  try {
    return await notificationProcessor.sendArrivalHints();
  } finally {
    running = false;
  }
}
