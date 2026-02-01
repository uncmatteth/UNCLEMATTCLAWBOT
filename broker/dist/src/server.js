import Fastify from "fastify";
import fs from "node:fs";
import { loadActions } from "./policy.js";
import { makeActionHandler } from "./actions/index.js";
import { makeLogger } from "./redact.js";
const CERT_DIR = process.env.BROKER_CERT_DIR ?? "/certs";
function readFile(p) { return fs.readFileSync(p); }
async function start() {
    const actions = loadActions(process.env.BROKER_ACTIONS_PATH ?? "/config/actions.json");
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
        https: httpsOptions,
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
