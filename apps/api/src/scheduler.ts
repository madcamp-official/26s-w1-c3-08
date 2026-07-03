import cron from "node-cron";
import { config } from "./config/env.js";
import { registerDomainEventHandlers } from "./events/register-events.js";
import { retryFailedModerationMessages } from "./jobs/retry-failed-moderation.job.js";
import { sendPendingMessages } from "./jobs/send-pending-messages.job.js";

registerDomainEventHandlers();

let deliveryRunning = false;
let moderationRetryRunning = false;

cron.schedule(config.deliveryCron, () => {
  if (deliveryRunning) {
    return;
  }

  deliveryRunning = true;
  void sendPendingMessages()
    .catch((error) => {
      console.error("sendPendingMessages failed", error);
    })
    .finally(() => {
      deliveryRunning = false;
    });
});

cron.schedule(config.moderationRetryCron, () => {
  if (moderationRetryRunning) {
    return;
  }

  moderationRetryRunning = true;
  void retryFailedModerationMessages()
    .catch((error) => {
      console.error("retryFailedModerationMessages failed", error);
    })
    .finally(() => {
      moderationRetryRunning = false;
    });
});

console.log("maeum-arrival scheduler started");
