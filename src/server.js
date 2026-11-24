import http from "http";

import { env, assertRequiredEnv } from "./config/env.js";
import { connectDb, disconnectDb, pingDb } from "./config/db.js";
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

  // Fly's own health check only confirms this process answers HTTP - it can't see a wedged DB
  // connection (stuck query, stalled volume I/O) since the server keeps responding to everything
  // except the database. Three consecutive failed pings here (~60s of a genuinely stuck DB, not
  // a single slow query) is the server's own signal that it's broken: exit so Fly's restart
  // policy (fly.toml: on-failure) brings up a clean process instead of this staying wedged until
  // someone notices and restarts it by hand.
  let consecutiveDbFailures = 0;
  setInterval(() => {
    pingDb(5000)
      .then(() => {
        consecutiveDbFailures = 0;
      })
      .catch((e) => {
        consecutiveDbFailures += 1;
        process.stderr.write(`[db-watchdog] ping failed (${consecutiveDbFailures}/3): ${e?.message ?? e}\n`);
        if (consecutiveDbFailures >= 3) {
          process.stderr.write("[db-watchdog] database unresponsive for ~60s, exiting so Fly restarts the machine\n");
          process.exit(1);
        }
      });
  }, 20 * 1000);

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
