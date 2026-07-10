import "dotenv/config";
// Must precede ./app: validation has to happen before PrismaClient is
// constructed, because constructing it loads .env into process.env and would
// mask a secret that is genuinely missing on the deploy target.
import "./config/assertEnvOnBoot";
import { createApp } from "./app";

const app = createApp();
const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`DataPilot backend listening on :${port}`);
});
