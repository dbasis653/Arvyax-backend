import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

//CORS configuration
const rawCorsOrigin = process.env.CORS_ORIGIN;
const corsOrigin =
  !rawCorsOrigin || rawCorsOrigin === "*"
    ? "*"
    : rawCorsOrigin.split(",").map((o) => o.trim());

app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type"],
  }),
);

import journalRouter from "./routes/journal.routes.js";
import userRouter from "./routes/user.routes.js";
import { errorHandler } from "./middlewares/error-handler.js";

app.use("/api/journal", journalRouter);
app.use("/api/users", userRouter);

// ── Error handler (must be last) ──
app.use(errorHandler);

export default app;
