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
    profile: "minimal",
    allow: ["uncle_matt_action"],
    deny: ["group:runtime", "group:fs", "group:ui", "group:browser"]
  }
}

## Broker actions

Actions are defined in `broker/config/actions.default.json` and validated by `broker/config/actions.schema.json`.
Only allow the upstream hosts/paths you intend to permit.
Use `upstream.port` if the upstream is not on 443.
You can optionally set `limits.maxInFlight` per action; otherwise the broker uses `BROKER_MAX_INFLIGHT` (default 32).

## Broker environment (required)
The broker enforces these safety checks at startup:

- `BROKER_SECRET_DIR` (default `/run/secrets`) must contain files for every `auth.secretRef`.
- `BROKER_REDACT_PATTERNS_PATH` (default `/config/log-redact.patterns.json`) must exist and be non-empty.

Optional (unsafe) overrides:
- `BROKER_SECRETS_REQUIRED=0` disables secret presence checks.
- `BROKER_REDACT_REQUIRED=0` disables redaction pattern checks.
- `BROKER_ALLOW_PRIVATE_IPS=1` allows private/localhost upstreams (breaks the “public-only” guarantee).

## Notes
- The allowlist behavior is opt-in for plugin tools; keep `tools.profile` restrictive.
- Keep the Broker bound to loopback unless you are intentionally exposing it.
