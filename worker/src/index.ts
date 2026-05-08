import express from "express";
import { ingestRouter } from "./routes/ingest";

const app = express();

// Tăng limit body để nhận file lớn (base64 ~33% inflate)
app.use(express.json({ limit: "200mb" }));

// Middleware verify internal secret
app.use((req, res, next) => {
  const secret = req.headers["x-worker-secret"];
  if (secret !== process.env.WORKER_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
});

app.use("/ingest", ingestRouter);

app.get("/health", (_, res) => res.json({ status: "ok", uptime: process.uptime() }));

const PORT = parseInt(process.env.PORT || "3001", 10);
app.listen(PORT, () => console.log(`RAG Worker listening on port ${PORT}`));
