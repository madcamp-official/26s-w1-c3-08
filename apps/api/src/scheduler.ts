import cron from "node-cron";
import { config } from "./config/env.js";
import { registerDomainEventHandlers } from "./events/register-events.js";
import { deliverMessageCollections } from "./jobs/deliver-message-collections.job.js";
import { retryFailedModerationMessages } from "./jobs/retry-failed-moderation.job.js";
import { retryPendingNotifications } from "./jobs/retry-pending-notifications.job.js";
import { sendArrivalHints } from "./jobs/send-arrival-hints.job.js";
import { sendPendingMessages } from "./jobs/send-pending-messages.job.js";

registerDomainEventHandlers();

let deliveryRunning = false;
let moderationRetryRunning = false;
let notificationRetryRunning = false;
let arrivalHintRunning = false;
let collectionDeliveryRunning = false;

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

function runNotificationRetryOnce(source: string) {
  if (notificationRetryRunning) {
    return;
  }

  notificationRetryRunning = true;
  void retryPendingNotifications()
    .then((result) => {
      if (result.processed > 0) {
        console.log(`retryPendingNotifications processed ${result.processed} notification(s) from ${source}`);
      }
    })
    .catch((error) => {
      console.error("retryPendingNotifications failed", error);
    })
    .finally(() => {
      notificationRetryRunning = false;
    });
}

function runArrivalHintsOnce(source: string) {
  if (arrivalHintRunning) {
    return;
  }

  arrivalHintRunning = true;
  void sendArrivalHints()
    .then((result) => {
      if (result.processed > 0) {
        console.log(`sendArrivalHints processed ${result.processed} message(s) from ${source}`);
      }
    })
    .catch((error) => {
      console.error("sendArrivalHints failed", error);
    })
    .finally(() => {
      arrivalHintRunning = false;
    });
}

function runCollectionDeliveryOnce(source: string) {
  if (collectionDeliveryRunning) {
    return;
  }

  collectionDeliveryRunning = true;
  void deliverMessageCollections()
    .then((result) => {
      if (result.processed > 0) {
        console.log(`deliverMessageCollections processed ${result.processed} collection(s) from ${source}`);
      }
    })
    .catch((error) => {
      console.error("deliverMessageCollections failed", error);
    })
    .finally(() => {
      collectionDeliveryRunning = false;
    });
}

cron.schedule(config.deliveryCron, () => runArrivalHintsOnce("cron"));
cron.schedule(config.deliveryCron, () => runDeliveryOnce("cron"));
cron.schedule(config.deliveryCron, () => runCollectionDeliveryOnce("cron"));
cron.schedule(config.moderationRetryCron, () => runModerationRetryOnce("cron"));
cron.schedule(config.notificationRetryCron, () => runNotificationRetryOnce("cron"));

runArrivalHintsOnce("startup");
runDeliveryOnce("startup");
runCollectionDeliveryOnce("startup");
runModerationRetryOnce("startup");
runNotificationRetryOnce("startup");

console.log("maeari scheduler started");
