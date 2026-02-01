// NOTE: This is a skeleton. Wire it to the official OpenClaw plugin SDK for tool registration.
// Do NOT add URL/host/headers as tool inputs.
//
// Tool name: uncle_matt_action (optional)

import { Type } from "@sinclair/typebox";
import https from "node:https";
import fs from "node:fs";

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
        const cfg = api.config?.plugins?.entries?.["uncle-matt"]?.config ?? {};
        const baseUrl: string = cfg.baseUrl;
        const timeoutMs: number = cfg.timeoutMs ?? 15000;

        const actionId = params.actionId;
        const body = JSON.stringify(params.json ?? {});
        const url = new URL(`/v1/action/${encodeURIComponent(actionId)}`, baseUrl);

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

        const respText = await httpJson(url, body, agent, timeoutMs);

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
