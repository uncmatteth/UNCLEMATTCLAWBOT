import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import fs from "node:fs";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { after, before, test } from "node:test";

let brokerProc: ReturnType<typeof spawn> | null = null;
let brokerPort = 0;

const fixturesDir = path.resolve(process.cwd(), "test/fixtures");
const actionsPath = path.resolve(process.cwd(), "config/actions.default.json");
const serverPath = path.resolve(process.cwd(), "dist/src/server.js");

const ca = fs.readFileSync(path.join(fixturesDir, "ca.crt"));
const clientCert = fs.readFileSync(path.join(fixturesDir, "client.crt"));
const clientKey = fs.readFileSync(path.join(fixturesDir, "client.key"));
const wrongCa = fs.readFileSync(path.join(fixturesDir, "wrong-ca.crt"));
const wrongClientCert = fs.readFileSync(path.join(fixturesDir, "wrong-client.crt"));
const wrongClientKey = fs.readFileSync(path.join(fixturesDir, "wrong-client.key"));

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

function httpsHealth(opts: { ca?: Buffer; cert?: Buffer; key?: Buffer }): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        host: "127.0.0.1",
        port: brokerPort,
        path: "/healthz",
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
      BROKER_CERT_DIR: fixturesDir,
      BROKER_ACTIONS_PATH: actionsPath,
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
