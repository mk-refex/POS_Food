import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the correct path
const envPath = path.resolve(__dirname, ".env");
dotenv.config({ path: envPath });

import http from "http";
import app from "./app.js";
import { initializeDatabase } from "./config/database.js";

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
