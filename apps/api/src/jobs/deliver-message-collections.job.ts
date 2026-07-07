import { deliverDueMessageCollections } from "../modules/collections/collection.service.js";

let running = false;

export async function deliverMessageCollections() {
  if (running) {
    return { processed: 0 };
  }

  running = true;

  try {
    return await deliverDueMessageCollections();
  } finally {
    running = false;
  }
}
