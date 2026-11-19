import http from "http";

import { env, assertRequiredEnv } from "./config/env.js";
import { connectDb, disconnectDb } from "./config/db.js";
import { buildApp } from "./app.js";
import { BootstrapService } from "./services/bootstrap.service.js";
import { startMaintenance } from "./jobs/maintenance.js";
import { hashPassword } from "./utils/password.js";

const main = async () => {
  assertRequiredEnv();

  await connectDb();
  await new BootstrapService({ hashPassword }).ensureDefaultAdmin();

  const app = buildApp();
  await app.locals.ensureAudiences?.().catch((e) => process.stderr.write(`[audiences] ${e?.message ?? e}\n`));
  const server = http.createServer(app);

  server.listen(env.port, "0.0.0.0");
  startMaintenance(app.locals.runMaintenance);
  // A stranded ride offer needs to move on well inside the minute the general sweep runs on -
  // its own fast, independent interval so it never competes with (or waits on) the other jobs.
  startMaintenance(app.locals.runRideMaintenance, { everyMs: 5 * 1000 });

  const shutdown = async () => {
    server.close(async () => {
      try {
        await disconnectDb();
      } finally {
        process.exit(0);
      }
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};

main().catch(() => process.exit(1));
