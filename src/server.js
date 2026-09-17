import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import express from "express";
import dotenv from "dotenv";
import { diffWords } from "diff";
import { openHistory } from "./db.js";
import { streamRewrite, sseWrite } from "./llm.js";
import { checkGrammar } from "./languagetool.js";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const port = Number(process.env.PORT) || 5170;
const history = openHistory(path.join(root, "data"));
const ltUrl = process.env.LANGUAGETOOL_URL || "http://localhost:8010";

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(root, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/rewrite", async (req, res) => {
  const mode = req.body?.mode;
  const tone = req.body?.tone || "standard";
  const input = String(req.body?.input ?? "").trim();
  if (!input) {
    res.status(400).json({ error: "Enter some text first." });
    return;
  }
  if (mode !== "paraphrase" && mode !== "summarize") {
    res.status(400).json({ error: "Mode must be paraphrase or summarize." });
    return;
  }
  res.setHeader("content-type", "text/event-stream");
  res.setHeader("cache-control", "no-cache");
  res.setHeader("connection", "keep-alive");
  res.flushHeaders?.();
  try {
    const output = await streamRewrite({
      env: process.env,
      mode,
      tone,
      input,
      res,
    });
    const parts = diffWords(input, output);
    history.save({ mode, tone, input, output });
    sseWrite(res, "done", { output, diff: parts });
  } catch (err) {
    sseWrite(res, "error", { error: err.message || String(err) });
  }
  res.end();
});

app.post("/api/grammar", async (req, res) => {
  const input = String(req.body?.input ?? "").trim();
  if (!input) {
    res.status(400).json({ error: "Enter some text first." });
    return;
  }
  try {
    const issues = await checkGrammar(ltUrl, input);
    const output = input;
    const parts = diffWords(input, output);
    history.save({ mode: "grammar", tone: null, input, output });
    res.json({ issues, output, diff: parts });
  } catch (err) {
    res.status(502).json({ error: err.message || String(err) });
  }
});

app.get("/api/history", (_req, res) => {
  res.json({ runs: history.last100() });
});

app.get("/history", (_req, res) => {
  res.sendFile(path.join(root, "public", "history.html"));
});

app.listen(port, () => {
  console.log(`paraphrase-local http://localhost:${port}`);
});
