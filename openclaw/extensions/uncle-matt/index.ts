import https from "node:https";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

type BrokerConfig = {
  baseUrl: URL;
  caPath: string;
  clientCertPath: string;
  clientKeyPath: string;
  timeoutMs: number;
  maxRequestBytes: number;
  maxResponseBytes: number;
};

export default function register(api: any) {
  api.registerTool(
    {
      name: "uncle_matt_action",
      description:
        "Call a hardened local Broker action via mTLS. Uncle Matt keeps secrets out of the agent and blocks exfil paths. No arbitrary URLs, no caller auth headers.",
      parameters: {
        type: "object",
        additionalProperties: false,
        required: ["actionId"],
        properties: {
          actionId: { type: "string", minLength: 1 },
          json: {}
        }
      },
      async execute(_id: string, params: any) {
        const cfg = parseConfig(api);

        const actionId = params.actionId;
        const body = JSON.stringify(params.json ?? {});
        const bodyBytes = Buffer.byteLength(body, "utf8");
        if (bodyBytes > cfg.maxRequestBytes) {
          throw new Error(`uncle-matt: request too large (${bodyBytes} bytes > ${cfg.maxRequestBytes} bytes)`);
        }
        const url = new URL(`/v1/action/${encodeURIComponent(actionId)}`, cfg.baseUrl);

        const ca = fs.readFileSync(cfg.caPath);
        const cert = fs.readFileSync(cfg.clientCertPath);
        const key = fs.readFileSync(cfg.clientKeyPath);

        const agent = new https.Agent({
          ca,
          cert,
          key,
          rejectUnauthorized: true,
          minVersion: "TLSv1.2",
        });

        const respText = await httpJson(url, body, agent, cfg.timeoutMs, cfg.maxResponseBytes);

        // Cap output to reduce abuse/exfil channels
        return { content: [{ type: "text", text: respText.slice(0, cfg.maxResponseBytes) }] };
      },
    },
    { optional: true },
  );
}

function httpJson(
  url: URL,
  body: string,
  agent: https.Agent,
  timeoutMs: number,
  maxResponseBytes: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const req = https.request(
      url,
      {
        method: "POST",
        agent,
        headers: { "content-type": "application/json" },
        timeout: timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        res.on("data", (chunk) => {
          if (settled) return;
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          const remaining = maxResponseBytes - bytes;
          if (remaining <= 0) {
            settled = true;
            res.destroy();
            return reject(new Error("broker_response_too_large"));
          }
          if (buf.length > remaining) {
            chunks.push(buf.subarray(0, remaining));
            bytes += remaining;
            settled = true;
            res.destroy();
            return resolve(Buffer.concat(chunks, bytes).toString("utf8"));
          }
          chunks.push(buf);
          bytes += buf.length;
        });
        res.on("end", () => {
          if (settled) return;
          settled = true;
          resolve(Buffer.concat(chunks, bytes).toString("utf8"));
        });
        res.on("error", (err) => {
          if (settled) return;
          settled = true;
          reject(err);
        });
      },
    );
    req.on("error", (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    });
    req.on("timeout", () => req.destroy(new Error("broker_timeout")));
    req.write(body);
    req.end();
  });
}

function parseConfig(api: any): BrokerConfig {
  const cfg = api.config?.plugins?.entries?.["uncle-matt"]?.config ?? {};
  const baseUrlRaw = String(cfg.baseUrl ?? "");
  if (!baseUrlRaw) {
    throw new Error("uncle-matt: missing baseUrl in plugins.entries.uncle-matt.config");
  }
  let baseUrl: URL;
  try {
    baseUrl = new URL(baseUrlRaw);
  } catch {
    throw new Error(`uncle-matt: invalid baseUrl: ${baseUrlRaw}`);
  }
  if (baseUrl.protocol !== "https:") {
    throw new Error(`uncle-matt: baseUrl must be https: ${baseUrlRaw}`);
  }
  if (baseUrl.username || baseUrl.password) {
    throw new Error(`uncle-matt: baseUrl must not include username/password: ${baseUrlRaw}`);
  }
  if (baseUrl.search || baseUrl.hash) {
    throw new Error(`uncle-matt: baseUrl must not include query or hash: ${baseUrlRaw}`);
  }
  if (baseUrl.pathname && baseUrl.pathname !== "/") {
    throw new Error(`uncle-matt: baseUrl path must be "/": ${baseUrlRaw}`);
  }
  if (baseUrl.port) {
    const portNum = Number(baseUrl.port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      throw new Error(`uncle-matt: invalid baseUrl port: ${baseUrlRaw}`);
    }
  }
  const host = baseUrl.hostname.toLowerCase();
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "::1") {
    throw new Error(`uncle-matt: baseUrl must be loopback (localhost/127.0.0.1/::1): ${baseUrlRaw}`);
  }

  const caPath = resolvePath(String(cfg.caPath ?? ""));
  const clientCertPath = resolvePath(String(cfg.clientCertPath ?? ""));
  const clientKeyPath = resolvePath(String(cfg.clientKeyPath ?? ""));
  if (!caPath || !clientCertPath || !clientKeyPath) {
    throw new Error("uncle-matt: missing cert paths (caPath/clientCertPath/clientKeyPath)");
  }
  assertFileExists(caPath, "caPath");
  assertFileExists(clientCertPath, "clientCertPath");
  assertFileExists(clientKeyPath, "clientKeyPath");

  const timeoutMs = Number(cfg.timeoutMs ?? 15000);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`uncle-matt: invalid timeoutMs: ${cfg.timeoutMs}`);
  }

  const maxRequestBytes = Number(cfg.maxRequestBytes ?? 1_000_000);
  if (!Number.isFinite(maxRequestBytes) || maxRequestBytes <= 0) {
    throw new Error(`uncle-matt: invalid maxRequestBytes: ${cfg.maxRequestBytes}`);
  }

  const maxResponseBytes = Number(cfg.maxResponseBytes ?? 50_000);
  if (!Number.isFinite(maxResponseBytes) || maxResponseBytes <= 0) {
    throw new Error(`uncle-matt: invalid maxResponseBytes: ${cfg.maxResponseBytes}`);
  }

  return { baseUrl, caPath, clientCertPath, clientKeyPath, timeoutMs, maxRequestBytes, maxResponseBytes };
}

function resolvePath(p: string): string {
  if (!p) return p;
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

function assertFileExists(p: string, label: string) {
  if (!fs.existsSync(p)) {
    throw new Error(`uncle-matt: ${label} not found: ${p}`);
  }
}
