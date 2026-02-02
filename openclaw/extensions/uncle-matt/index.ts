import { Type } from "@sinclair/typebox";
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
};

export default function register(api: any) {
  api.registerTool(
    {
      name: "uncle_matt_action",
      description:
        "Call a hardened local Broker action via mTLS. Uncle Matt keeps secrets out of the agent and blocks exfil paths. No arbitrary URLs, no caller auth headers.",
      parameters: Type.Object({
        actionId: Type.String({ minLength: 1 }),
        json: Type.Any(),
      }),
      async execute(_id: string, params: any) {
        const cfg = parseConfig(api);

        const actionId = params.actionId;
        const body = JSON.stringify(params.json ?? {});
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

        const respText = await httpJson(url, body, agent, cfg.timeoutMs);

        // Cap output to reduce abuse/exfil channels
        return { content: [{ type: "text", text: respText.slice(0, 50_000) }] };
      },
    },
    { optional: true },
  );
}

function httpJson(url: URL, body: string, agent: https.Agent, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: "POST",
        agent,
        headers: { "content-type": "application/json" },
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => resolve(data));
      },
    );
    req.on("error", reject);
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

  return { baseUrl, caPath, clientCertPath, clientKeyPath, timeoutMs };
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
