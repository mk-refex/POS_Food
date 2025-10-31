import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import apiRouter from "./routes/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(
  cors({
    origin: (_origin, cb) => cb(null, true), // allow all origins
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "x-api-key",
    ],
  })
);
// Explicit preflight handling for all routes
app.options("*", cors());

// Relax referrer policy if needed for cross-origin requests
app.use((req, res, next) => {
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.use("/api", apiRouter);

// Serve static files from the client build directory
const clientPath = path.join(__dirname, "../client/build");
app.use(express.static(clientPath));

// Handle client-side routing - serve index.html for all non-API routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

export default app;
