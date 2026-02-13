import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the correct path
const envPath = path.resolve(__dirname, ".env");
dotenv.config({ path: envPath });

import http from "http";
import cron from "node-cron";
import app from "./app.js";
import { initializeDatabase } from "./config/database.js";
import { runHrmsSync } from "./services/hrmsSync.js";

const port = Number(process.env.PORT) || 3000;

async function start() {
  try {
    await initializeDatabase();
    console.log("Database connected successfully");
  } catch (error) {
    console.warn(
      "Database connection failed, but server will start anyway:",
      error.message
    );
  }

  // HRMS sync: wait a bit after startup, then run once (with retries); also runs daily at 10 PM
  const startupDelayMs = Number(process.env.HRMS_SYNC_STARTUP_DELAY_MS) || 15000; // 15s default
  const maxRetries = Number(process.env.HRMS_SYNC_STARTUP_RETRIES) || 3;
  const retryDelayMs = Number(process.env.HRMS_SYNC_RETRY_DELAY_MS) || 10000; // 10s between retries

  (async () => {
    console.log(`[Startup] HRMS sync will run in ${startupDelayMs / 1000}s…`);
    await new Promise((r) => setTimeout(r, startupDelayMs));
    let lastError;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Startup] Running HRMS sync (attempt ${attempt}/${maxRetries})…`);
        const result = await runHrmsSync();
        if (result.error) {
          lastError = result.error;
          throw new Error(result.error);
        }
        console.log(
          "[Startup] HRMS sync done: created",
          result.created.employees + result.created.supportStaff,
          "updated",
          result.updated.employees + result.updated.supportStaff
        );
        return;
      } catch (err) {
        lastError = err;
        console.warn(`[Startup] HRMS sync attempt ${attempt} failed:`, err.message);
        if (attempt < maxRetries) {
          console.log(`[Startup] Retrying in ${retryDelayMs / 1000}s…`);
          await new Promise((r) => setTimeout(r, retryDelayMs));
        }
      }
    }
    console.warn("[Startup] HRMS sync failed after all retries:", lastError?.message);
  })();

  cron.schedule("0 22 * * *", async () => {
    console.log("[Cron] Running HRMS sync (10 PM daily)…");
    try {
      const result = await runHrmsSync();
      if (result.error) {
        console.error("[Cron] HRMS sync error:", result.error);
      } else {
        console.log(
          "[Cron] HRMS sync done: created",
          result.created.employees + result.created.supportStaff,
          "updated",
          result.updated.employees + result.updated.supportStaff
        );
      }
    } catch (err) {
      console.error("[Cron] HRMS sync failed:", err.message);
    }
  });
  console.log("Cron: HRMS sync scheduled daily at 10:00 PM");

  const server = http.createServer(app);
  server.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`API server listening on http://localhost:${port}`);
    console.log(`Client application available at http://localhost:${port}`);
  });
}

start().catch((error) => {
  // eslint-disable-next-line no-console
  console.error("Failed to start server:", error);
  process.exit(1);
});
