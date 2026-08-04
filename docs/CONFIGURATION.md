# Configuration

This is a minimal, safe configuration example. Adjust paths to your environment.

## OpenClaw config (JSON5)

{
  plugins: {
    enabled: true,
    allow: ["uncle-matt"],
    load: { paths: ["/ABS/PATH/UNCLEMATTCLAWBOT/openclaw/extensions/uncle-matt"] },
    entries: {
      "uncle-matt": {
        enabled: true,
        config: {
          baseUrl: "https://127.0.0.1:8443",
          caPath: "~/.secure-openclaw/certs/ca.crt",
          clientCertPath: "~/.secure-openclaw/certs/client.crt",
          clientKeyPath: "~/.secure-openclaw/certs/client.key",
          timeoutMs: 15000,
          maxRequestBytes: 1000000,
          maxResponseBytes: 50000,
          voicePackEnabled: false
        }
      }
    }
  },
  agents: {
    defaults: {
      sandbox: {
        mode: "all",
        workspaceAccess: "none",
        docker: { network: "none", readOnlyRoot: true }
      }
    }
  },
  tools: {
    // OpenClaw filters optional plugin tools out of the minimal profile before
    // applying tools.allow. Start from full and narrow to this one tool.
    profile: "full",
    allow: ["uncle_matt_action"],
    deny: ["group:runtime", "group:fs", "group:ui", "group:browser"],
    // Sandbox tool policy is a second intersection.
    sandbox: { tools: { alsoAllow: ["uncle_matt_action"] } }
  }
}

## Broker actions

Actions are defined in `broker/config/actions.default.json` and validated by `broker/config/actions.schema.json`.
Only allow the upstream hosts/paths you intend to permit.
Use `upstream.port` if the upstream is not on 443.
You can optionally set `limits.maxInFlight` per action; otherwise the broker uses `BROKER_MAX_INFLIGHT` (default 32).

Current default actions are read-only Tommy proof reads:

- `tommy_site_health_read` -> `https://hamburgersite.vercel.app/api/health`
- `tommy_stop_status_read` -> `https://hamburgersite.vercel.app/stoptommyfromdatingyourmom/api/status`
- `tommy_stop_epoch_read` -> `https://hamburgersite.vercel.app/stoptommyfromdatingyourmom/api/epoch/current`
- `tommy_public_proof_read` -> `https://hamburgersite.vercel.app/arcade/tommy-hallway-heist`

There is intentionally no `demo_ping` action in the default config.

## Broker environment (required)
The broker enforces these safety checks at startup:

- `BROKER_SECRET_DIR` (default `/run/secrets`) must contain files for every `auth.secretRef`.
- `BROKER_REDACT_PATTERNS_PATH` (default `/config/log-redact.patterns.json`) must exist and be non-empty.

Optional (unsafe) overrides:
- `BROKER_SECRETS_REQUIRED=0` disables secret presence checks.
- `BROKER_REDACT_REQUIRED=0` disables redaction pattern checks.
- `BROKER_ALLOW_PRIVATE_IPS=1` allows private/localhost upstreams (breaks the “public-only” guarantee).

## Notes
- Keep `tools.allow` restricted to `uncle_matt_action`. The `full` profile is
  required so OpenClaw does not filter out the optional plugin tool before the
  explicit allowlist is applied.
- Keep `tools.sandbox.tools.alsoAllow` restricted to `uncle_matt_action`; without
  it, sandbox policy removes the registered plugin tool and agent turns abort.
- Keep the Broker bound to loopback unless you are intentionally exposing it.
