import { config } from "./config/env.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(config.apiPort, () => {
  console.log(`maeum-arrival api listening on ${config.apiPort}`);
});
