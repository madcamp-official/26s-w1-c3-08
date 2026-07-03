import cron from "node-cron";
import { config } from "./config/env.js";
import { registerDomainEventHandlers } from "./events/register-events.js";
import { retryFailedModerationMessages } from "./jobs/retry-failed-moderation.job.js";
import { sendPendingMessages } from "./jobs/send-pending-messages.job.js";

registerDomainEventHandlers();

let deliveryRunning = false;
let moderationRetryRunning = false;

function runDeliveryOnce(source: string) {
  if (deliveryRunning) {
    return;
  }

  deliveryRunning = true;
  void sendPendingMessages()
    .then((result) => {
      if (result.processed > 0) {
        console.log(`sendPendingMessages processed ${result.processed} message(s) from ${source}`);
      }
    })
    .catch((error) => {
      console.error("sendPendingMessages failed", error);
    })
    .finally(() => {
      deliveryRunning = false;
    });
}

function runModerationRetryOnce(source: string) {
  if (moderationRetryRunning) {
    return;
  }

  moderationRetryRunning = true;
  void retryFailedModerationMessages()
    .then((result) => {
      if (result.processed > 0) {
        console.log(`retryFailedModerationMessages processed ${result.processed} message(s) from ${source}`);
      }
    })
    .catch((error) => {
      console.error("retryFailedModerationMessages failed", error);
    })
    .finally(() => {
      moderationRetryRunning = false;
    });
}

cron.schedule(config.deliveryCron, () => runDeliveryOnce("cron"));
cron.schedule(config.moderationRetryCron, () => runModerationRetryOnce("cron"));

runDeliveryOnce("startup");
runModerationRetryOnce("startup");

console.log("maeum-arrival scheduler started");
