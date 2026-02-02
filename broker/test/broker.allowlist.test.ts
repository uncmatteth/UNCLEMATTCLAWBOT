import Fastify from "fastify";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import { makeActionHandler } from "../src/actions/index.js";

type RequestFn = (url: string | URL | import("node:url").UrlObject, opts?: any) => Promise<any>;

function baseActions(overrides: Partial<any> = {}) {
  return {
    actions: {
      demo: {
        upstream: { host: "example.com", path: "/ok" },
        method: "GET",
        pathAllowlist: ["/ok"],
        request: { maxBodyBytes: 1024, allowedContentTypes: ["application/json"] },
        auth: { kind: "none" },
        rateLimit: { maxRequests: 100, windowSeconds: 60 },
        budget: { maxRequests: 1000, windowSeconds: 3600 },
        limits: { maxResponseBytes: 16 },
        ...overrides
      }
    }
  };
}

async function buildApp(requestFn: RequestFn, overrides: Partial<any> = {}, allowPrivate = true) {
  process.env.BROKER_ALLOW_PRIVATE_IPS = allowPrivate ? "1" : "0";
  const app = Fastify({ logger: false });
  app.post("/v1/action/:id", makeActionHandler({ actions: baseActions(overrides), requestFn }));
  return app;
}

function makeResp(statusCode: number, body: string) {
  return {
    statusCode,
    body: Readable.from([Buffer.from(body, "utf8")])
  };
}

test("unknown action denied", async () => {
  const app = await buildApp(async () => {
    throw new Error("unexpected request");
  });
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/action/nope",
      payload: { ok: true }
    });
    assert.equal(res.statusCode, 404);
    assert.equal(res.json().error, "unknown_action");
  } finally {
    await app.close();
  }
});

test("caller auth header denied", async () => {
  let called = false;
  const app = await buildApp(async () => {
    called = true;
    return makeResp(200, "{}");
  });
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/action/demo",
      headers: { authorization: "Bearer nope" },
      payload: { ok: true }
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.json().error, "caller_auth_header_denied");
    assert.equal(called, false);
  } finally {
    await app.close();
  }
});

test("redirects denied", async () => {
  const app = await buildApp(async () => makeResp(302, "redirect"));
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/action/demo",
      payload: { ok: true }
    });
    assert.equal(res.statusCode, 502);
    assert.equal(res.json().error, "upstream_redirect_denied");
  } finally {
    await app.close();
  }
});

test("response size cap enforced", async () => {
  const app = await buildApp(async () => makeResp(200, "1234567"), {
    limits: { maxResponseBytes: 4 }
  });
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/action/demo",
      payload: { ok: true }
    });
    assert.equal(res.statusCode, 502);
    assert.equal(res.json().error, "upstream_response_too_large");
  } finally {
    await app.close();
  }
});

test("private upstream host blocked", async () => {
  let called = false;
  const app = await buildApp(async () => {
    called = true;
    return makeResp(200, "{}");
  }, {
    upstream: { host: "127.0.0.1", path: "/ok" }
  }, false);
  try {
    const res = await app.inject({
      method: "POST",
      url: "/v1/action/demo",
      payload: { ok: true }
    });
    assert.equal(res.statusCode, 502);
    assert.equal(res.json().error, "upstream_private_address_blocked");
    assert.equal(called, false);
  } finally {
    await app.close();
  }
});

test("in-flight cap enforced", async () => {
  let started = false;
  let release: () => void = () => {};
  const blocker = new Promise<void>((resolve) => {
    release = resolve;
  });
  const app = await buildApp(async () => {
    started = true;
    await blocker;
    return makeResp(200, "{}");
  }, {
    limits: { maxResponseBytes: 16, maxInFlight: 1 }
  });
  try {
    const first = app.inject({
      method: "POST",
      url: "/v1/action/demo",
      payload: { ok: true }
    });
    while (!started) {
      await new Promise((r) => setTimeout(r, 5));
    }
    const second = await app.inject({
      method: "POST",
      url: "/v1/action/demo",
      payload: { ok: true }
    });
    assert.equal(second.statusCode, 429);
    assert.equal(second.json().error, "in_flight_limited");
    release();
    const res = await first;
    assert.equal(res.statusCode, 200);
  } finally {
    await app.close();
  }
});
