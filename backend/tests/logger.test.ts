import assert from "node:assert/strict";
import { once } from "node:events";
import { Writable } from "node:stream";
import test from "node:test";
import express from "express";
import winston from "winston";
import { logger, requestLogger } from "../src/logger.js";

test("readable logs preserve errors, redact credentials, and correlate HTTP requests", async () => {
  const lines: string[] = [];
  logger.clear();
  logger.level = "info";
  logger.add(new winston.transports.Stream({ stream: new Writable({
    write(chunk, _encoding, done) { lines.push(chunk.toString()); done(); },
  }) }));
  logger.info("Logging check", { password: "secret-value", nested: { refreshToken: "token-value" } });
  logger.error("Failure check", { err: new Error("Database offline") });
  assert.match(lines[0], /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] INFO\s+\| Logging check/);
  assert.match(lines[0], /REDACTED/);
  assert.doesNotMatch(lines[0], /secret-value|token-value/);
  assert.match(lines[1], /Database offline/);
  assert.match(lines[1], /stack/);

  const app = express();
  app.use(requestLogger);
  app.use(express.json());
  app.get("/ok", (_req, res) => res.sendStatus(200));
  app.get("/missing", (_req, res) => res.sendStatus(404));
  app.post("/login", (_req, res) => res.status(401).json({ error: { message: "Invalid credentials" }, token: "private-response" }));
  app.get("/failed", (_req, res) => res.sendStatus(500));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    for (const [route, status, level] of [["ok", 200, "INFO"], ["missing", 404, "ERROR"], ["failed", 500, "ERROR"]] as const) {
      const response = await fetch(`${base}/${route}?token=private-query`, { headers: { Authorization: "Bearer private-header" } });
      await response.text();
      assert.equal(response.status, status);
      const id = response.headers.get("x-request-id");
      assert.ok(id);
      const line = lines.find(line => line.includes(`GET /${route} -> ${status}`));
      assert.ok(line);
      assert.match(line, new RegExp(`${level}\\s+\\| GET /${route} -> ${status} \\(\\d+ms\\) \\|`));
      assert.doesNotMatch(line, /requestId=|durationMs=/);
      assert.doesNotMatch(line, /private-query|private-header|\?token/);
    }
    const response = await fetch(`${base}/ok`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    await response.text();
    assert.equal(response.status, 400);
    assert.ok(lines.some(line => line.includes("POST /ok -> 400")));
    const login = await fetch(`${base}/login`, { method: "POST" });
    await login.text();
    assert.ok(lines.some(line => /ERROR \| POST \/login -> 401 \(\d+ms\) \| Invalid credentials/.test(line)));
    assert.ok(lines.every(line => !line.includes("private-response")));
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    logger.close();
  }
});
