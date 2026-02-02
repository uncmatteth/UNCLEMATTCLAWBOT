import { request } from "undici";
import fs from "node:fs";
import { loadRedactPatterns, redactText } from "../redact.js";
import { FixedWindowLimiter } from "../rateLimit.js";
import { createPublicHostGuard } from "../netGuard.js";

type RequestFn = typeof request;

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

function parseMs(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

const CONNECT_TIMEOUT_MS = parseMs(process.env.BROKER_CONNECT_TIMEOUT_MS, 5_000);
const HEADERS_TIMEOUT_MS = parseMs(process.env.BROKER_HEADERS_TIMEOUT_MS, 10_000);
const BODY_TIMEOUT_MS = parseMs(process.env.BROKER_BODY_TIMEOUT_MS, 10_000);
const TOTAL_TIMEOUT_MS = parseMs(process.env.BROKER_TOTAL_TIMEOUT_MS, 15_000);
const MAX_INFLIGHT_GLOBAL = parsePositiveInt(process.env.BROKER_MAX_INFLIGHT, 32);

function readSecret(secretRef: string): string {
  const baseDir = process.env.BROKER_SECRET_DIR ?? "/run/secrets";
  const p = `${baseDir}/${secretRef}`;
  return fs.readFileSync(p, "utf8").trim();
}

function safeJsonParse(s: string) {
  try { return JSON.parse(s); } catch { return { raw: s }; }
}

export function makeActionHandler({ actions, requestFn = request }: { actions: any; requestFn?: RequestFn }) {
  const patternsPath = process.env.BROKER_REDACT_PATTERNS_PATH ?? "/config/log-redact.patterns.json";
  const redactPatterns = loadRedactPatterns(patternsPath);
  const dnsCacheTtlMs = parseMs(process.env.BROKER_DNS_CACHE_TTL_MS, 60_000);
  const allowPrivate = process.env.BROKER_ALLOW_PRIVATE_IPS === "1";
  const { assertPublicHost, lookup } = createPublicHostGuard({ cacheTtlMs: dnsCacheTtlMs, allowPrivate });
  const rateLimiters = new Map<string, FixedWindowLimiter>();
  const budgetLimiters = new Map<string, FixedWindowLimiter>();
  const inFlightByAction = new Map<string, number>();
  let inFlightGlobal = 0;
  const actionEntries = Object.entries(actions.actions ?? {}) as [string, any][];
  for (const [id, policy] of actionEntries) {
    if (policy?.rateLimit) rateLimiters.set(id, new FixedWindowLimiter(policy.rateLimit));
    if (policy?.budget) budgetLimiters.set(id, new FixedWindowLimiter(policy.budget));
  }
  return async function handler(req: any, reply: any) {
    const actionId = req.params.id;
    const policy = actions.actions[actionId];
    if (!policy) return reply.code(404).send({ error: "unknown_action" });

    const rateLimiter = rateLimiters.get(actionId);
    if (rateLimiter && !rateLimiter.consume()) {
      return reply.code(429).send({ error: "rate_limited" });
    }
    const budgetLimiter = budgetLimiters.get(actionId);
    if (budgetLimiter && !budgetLimiter.consume()) {
      return reply.code(429).send({ error: "budget_exceeded" });
    }

    // Deny caller-supplied auth headers always
    const h = req.headers ?? {};
    if (h["authorization"] || h["proxy-authorization"]) {
      return reply.code(400).send({ error: "caller_auth_header_denied" });
    }

    const ct = (req.headers["content-type"] ?? "").split(";")[0].trim();
    let bodyPayload: string | Buffer | Uint8Array | undefined;
    let bodyBytes = 0;
    if (req.body === undefined || req.body === null) {
      bodyPayload = undefined;
      bodyBytes = 0;
    } else if (typeof req.body === "string") {
      bodyPayload = req.body;
      bodyBytes = Buffer.byteLength(req.body, "utf8");
    } else if (Buffer.isBuffer(req.body) || req.body instanceof Uint8Array) {
      bodyPayload = req.body;
      bodyBytes = req.body.length;
    } else {
      const serialized = JSON.stringify(req.body);
      bodyPayload = serialized;
      bodyBytes = Buffer.byteLength(serialized, "utf8");
    }

    if (bodyBytes > 0 && !policy.request.allowedContentTypes.includes(ct)) {
      return reply.code(415).send({ error: "unsupported_content_type" });
    }

    if (bodyBytes > policy.request.maxBodyBytes) {
      return reply.code(413).send({ error: "body_too_large" });
    }

    // Caller cannot choose host/path. Policy defines upstream.
    const upstreamUrl = `https://${policy.upstream.host}${policy.upstream.path}`;
    if (!policy.pathAllowlist.includes(policy.upstream.path)) {
      return reply.code(500).send({ error: "policy_misconfigured" });
    }

    const method = String(policy.method ?? "").toUpperCase();
    if (!ALLOWED_METHODS.has(method)) {
      return reply.code(500).send({ error: "policy_misconfigured" });
    }

    if (!allowPrivate) {
      try {
        await assertPublicHost(policy.upstream.host);
      } catch {
        return reply.code(502).send({ error: "upstream_private_address_blocked" });
      }
    }

    const maxInFlightAction = Number(policy?.limits?.maxInFlight ?? MAX_INFLIGHT_GLOBAL);
    if (!Number.isFinite(maxInFlightAction) || maxInFlightAction <= 0) {
      return reply.code(500).send({ error: "policy_misconfigured" });
    }
    const currentInFlight = inFlightByAction.get(actionId) ?? 0;
    if (inFlightGlobal >= MAX_INFLIGHT_GLOBAL || currentInFlight >= maxInFlightAction) {
      return reply.code(429).send({ error: "in_flight_limited" });
    }
    inFlightGlobal += 1;
    inFlightByAction.set(actionId, currentInFlight + 1);

    try {
      const headers: Record<string, string> = {
        "user-agent": "uncle-matt-broker/0.1",
      };

    // Inject auth internally only
    if (policy.auth.kind === "bearer") {
      headers["authorization"] = `Bearer ${readSecret(policy.auth.secretRef)}`;
    } else if (policy.auth.kind === "header") {
      headers[policy.auth.headerName] = readSecret(policy.auth.secretRef);
    }

      // Undici doesn't follow redirects unless told; enforce no redirects anyway.
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TOTAL_TIMEOUT_MS);
      let resp: any;
      try {
        const requestOptions: any = {
          method,
          headers,
          body: method === "GET" ? undefined : bodyPayload,
          maxRedirections: 0,
          lookup,
          signal: controller.signal,
          connectTimeout: CONNECT_TIMEOUT_MS,
          headersTimeout: HEADERS_TIMEOUT_MS,
          bodyTimeout: BODY_TIMEOUT_MS,
        };
        resp = await requestFn(upstreamUrl, requestOptions);
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err?.name === "AbortError") {
          return reply.code(504).send({ error: "upstream_timeout" });
        }
        return reply.code(502).send({ error: "upstream_request_failed" });
      } finally {
        clearTimeout(timeoutId);
      }

      if (resp.statusCode >= 300 && resp.statusCode < 400) {
        resp.body?.destroy?.();
        return reply.code(502).send({ error: "upstream_redirect_denied" });
      }

      let text = "";
      if (resp.body) {
        const chunks: Buffer[] = [];
        let bytes = 0;
        try {
          for await (const chunk of resp.body) {
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            bytes += buf.length;
            if (bytes > policy.limits.maxResponseBytes) {
              resp.body.destroy?.();
              return reply.code(502).send({ error: "upstream_response_too_large" });
            }
            chunks.push(buf);
          }
        } catch {
          return reply.code(502).send({ error: "upstream_response_failed" });
        }
        text = Buffer.concat(chunks).toString("utf8");
      }

      const redacted = redactText(text, redactPatterns);
      return reply.code(resp.statusCode).send({
        actionId,
        status: resp.statusCode,
        body: safeJsonParse(redacted),
      });
    } finally {
      inFlightGlobal = Math.max(0, inFlightGlobal - 1);
      const next = (inFlightByAction.get(actionId) ?? 1) - 1;
      if (next <= 0) inFlightByAction.delete(actionId);
      else inFlightByAction.set(actionId, next);
    }
  };
}
