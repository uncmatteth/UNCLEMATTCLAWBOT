import Fastify from "fastify";
import fs from "node:fs";
import { loadActions } from "./policy.js";
import { makeActionHandler } from "./actions/index.js";
import { assertRedactPatterns, makeLogger } from "./redact.js";

const CERT_DIR = process.env.BROKER_CERT_DIR ?? "/certs";

function readFile(p: string) { return fs.readFileSync(p); }

function collectSecretRefs(actions: any): string[] {
  const refs = new Set<string>();
  for (const policy of Object.values(actions.actions ?? {})) {
    const auth = (policy as any)?.auth;
    if (!auth || auth.kind === "none") continue;
    if (typeof auth.secretRef === "string" && auth.secretRef.length > 0) refs.add(auth.secretRef);
  }
  return Array.from(refs);
}

function assertSecretsPresent(actions: any) {
  const requireSecrets = process.env.BROKER_SECRETS_REQUIRED !== "0";
  if (!requireSecrets) return;
  const secretDir = process.env.BROKER_SECRET_DIR ?? "/run/secrets";
  const refs = collectSecretRefs(actions);
  const missing: string[] = [];
  for (const ref of refs) {
    const p = `${secretDir}/${ref}`;
    if (!fs.existsSync(p)) {
      missing.push(ref);
      continue;
    }
    const contents = fs.readFileSync(p, "utf8").trim();
    if (!contents) missing.push(ref);
  }
  if (missing.length) {
    throw new Error(`Missing required secrets in ${secretDir}: ${missing.join(", ")}`);
  }
}

async function start() {
  const actions = loadActions(process.env.BROKER_ACTIONS_PATH ?? "/config/actions.json");
  assertSecretsPresent(actions);
  if (process.env.BROKER_REDACT_REQUIRED !== "0") {
    const patternsPath = process.env.BROKER_REDACT_PATTERNS_PATH ?? "/config/log-redact.patterns.json";
    assertRedactPatterns(patternsPath);
  }

  const httpsOptions = {
    key: readFile(`${CERT_DIR}/server.key`),
    cert: readFile(`${CERT_DIR}/server.crt`),
    ca: readFile(`${CERT_DIR}/ca.crt`),
    requestCert: true,
    rejectUnauthorized: true,
    minVersion: "TLSv1.2",
  };

  const app = Fastify({
    logger: makeLogger(),
    bodyLimit: Number(process.env.BROKER_MAX_BODY_BYTES ?? 1_000_000),
    trustProxy: false,
    https: httpsOptions as any,
  });

  app.get("/healthz", async () => ({ ok: true }));
  app.get("/v1/actions", async () => ({ actions: Object.keys(actions.actions) }));
  app.post("/v1/action/:id", makeActionHandler({ actions }));

  await app.listen({
    host: process.env.BROKER_BIND ?? "127.0.0.1",
    port: Number(process.env.BROKER_PORT ?? 8443),
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
