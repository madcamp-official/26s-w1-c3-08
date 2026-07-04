import { config } from "./config/env.js";
import { createApp } from "./app.js";

const app = createApp();

app.listen(config.apiPort, () => {
  console.log(`maeari api listening on ${config.apiPort}`);
});
