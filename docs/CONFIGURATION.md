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
          clientCertPath: "~/.secure-openclaw/certs/openclaw-client.crt",
          clientKeyPath: "~/.secure-openclaw/certs/openclaw-client.key",
          timeoutMs: 15000,
          voicePackEnabled: false
        }
      }
    }
  },
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        workspaceAccess: "none",
        docker: { network: "none", readOnlyRoot: true }
      }
    }
  },
  tools: {
    profile: "minimal",
    allow: ["uncle_matt_action"],
    deny: ["group:runtime", "group:fs", "group:ui"]
  }
}

## Broker actions

Actions are defined in `broker/config/actions.default.json` and validated by `broker/config/actions.schema.json`.
Only allow the upstream hosts/paths you intend to permit.

## Notes
- The allowlist behavior is opt-in for plugin tools; keep `tools.profile` restrictive.
- Keep the Broker bound to loopback unless you are intentionally exposing it.
