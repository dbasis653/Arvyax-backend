import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

const app = express();

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") || "http://localhost:5173",
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
