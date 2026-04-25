import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";

let brokerProc: ReturnType<typeof spawn> | null = null;
let brokerPort = 0;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const brokerRoot = path.resolve(__dirname, "..", "..");
const repoRoot = path.resolve(brokerRoot, "..");
const actionsPath = path.resolve(brokerRoot, "config/actions.default.json");
const serverPath = path.resolve(brokerRoot, "dist/src/server.js");
const certScript = path.resolve(repoRoot, "scripts/generate-certs.sh");

const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "uncle-matt-broker-test-"));
const correctDir = path.join(tempRoot, "correct");
const wrongDir = path.join(tempRoot, "wrong");

function generateCerts(outDir: string) {
  const res = spawnSync("bash", [certScript, "--out", outDir, "--force"], { stdio: "inherit" });
  if (res.status !== 0) {
    throw new Error(`failed to generate certs in ${outDir}`);
  }
}

generateCerts(correctDir);
generateCerts(wrongDir);

const ca = fs.readFileSync(path.join(correctDir, "ca.crt"));
const clientCert = fs.readFileSync(path.join(correctDir, "client.crt"));
const clientKey = fs.readFileSync(path.join(correctDir, "client.key"));
const wrongCa = fs.readFileSync(path.join(wrongDir, "ca.crt"));
const wrongClientCert = fs.readFileSync(path.join(wrongDir, "client.crt"));
const wrongClientKey = fs.readFileSync(path.join(wrongDir, "client.key"));

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr && typeof addr !== "string") {
        const port = addr.port;
        srv.close(() => resolve(port));
      } else {
        srv.close(() => reject(new Error("failed to allocate port")));
      }
    });
  });
}

function httpsGet(pathname: string, opts: { ca?: Buffer; cert?: Buffer; key?: Buffer }): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: "127.0.0.1",
        port: brokerPort,
        path: pathname,
        method: "GET",
        ca: opts.ca,
        cert: opts.cert,
        key: opts.key,
        rejectUnauthorized: true
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve({ statusCode: res.statusCode ?? 0, body: data }));
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function httpsHealth(opts: { ca?: Buffer; cert?: Buffer; key?: Buffer }): Promise<{ statusCode: number; body: string }> {
  return httpsGet("/healthz", opts);
}

async function waitForReady() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const res = await httpsHealth({ ca, cert: clientCert, key: clientKey });
      if (res.statusCode === 200) return;
    } catch {
      // wait and retry
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error("broker did not become ready");
}

before(async () => {
  brokerPort = await getFreePort();
  brokerProc = spawn(process.execPath, [serverPath], {
    env: {
      ...process.env,
      BROKER_CERT_DIR: correctDir,
      BROKER_ACTIONS_PATH: actionsPath,
      BROKER_REDACT_PATTERNS_PATH: path.resolve(brokerRoot, "config/log-redact.patterns.json"),
      BROKER_ALLOW_PRIVATE_IPS: "1",
      BROKER_BIND: "127.0.0.1",
      BROKER_PORT: String(brokerPort),
      BROKER_LOG_LEVEL: "error"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  await waitForReady();
});

after(async () => {
  if (!brokerProc) return;
  brokerProc.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      brokerProc?.kill("SIGKILL");
      resolve(null);
    }, 2000);
    brokerProc?.once("exit", () => {
      clearTimeout(timer);
      resolve(null);
    });
  });
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test("mTLS rejects missing client cert", async () => {
  await assert.rejects(() => httpsHealth({ ca }));
});

test("mTLS rejects wrong CA", async () => {
  await assert.rejects(() => httpsHealth({ ca: wrongCa, cert: clientCert, key: clientKey }));
});

test("mTLS rejects untrusted client cert", async () => {
  await assert.rejects(() => httpsHealth({ ca, cert: wrongClientCert, key: wrongClientKey }));
});

test("mTLS accepts valid client cert", async () => {
  const res = await httpsHealth({ ca, cert: clientCert, key: clientKey });
  assert.equal(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.deepEqual(parsed, { ok: true });
});

test("mTLS action list exposes Tommy read-only actions only", async () => {
  const res = await httpsGet("/v1/actions", { ca, cert: clientCert, key: clientKey });
  assert.equal(res.statusCode, 200);
  const parsed = JSON.parse(res.body);
  assert.deepEqual([...parsed.actions].sort(), [
    "tommy_public_proof_read",
    "tommy_site_health_read",
    "tommy_stop_epoch_read",
    "tommy_stop_status_read",
  ]);
  assert.equal(parsed.actions.includes("demo_ping"), false);
});
