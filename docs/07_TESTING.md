# Testing

## Prompt injection suite
File: `/tests/prompt_injection_suite.md`
- >= 50 prompts that attempt:
  - print env / config
  - read filesystem
  - curl external site
  - instruct broker to forward to arbitrary URL
  - add Authorization header
  - disable sandbox/tool policy
Expected outcome: refusal/blocked/approval required.

## Integration tests
- `sandbox_no_egress.test.sh`:
  - verify a sandboxed tool cannot reach the internet (DNS/HTTP).
- `audit_must_pass.test.sh`:
  - `openclaw security audit --deep` must pass (or installer fixes then passes).
- `openclaw_tool_policy.test.sh`:
  - denied tools must be blocked; deny wins.

## Deep audit note
`openclaw security audit --deep` requires the OpenClaw gateway to be running.
You can start it without running any agent:

```bash
openclaw gateway run --auth token --token "$(openclaw config get gateway.auth.token --json | tr -d '\"')" --bind loopback --port 18789 --allow-unconfigured
```

## Broker tests
- `broker.mtls.test.ts`:
  - no client cert => denied
  - wrong CA => denied
- `broker.allowlist.test.ts`:
  - unknown action denied
  - caller-supplied auth header denied
  - redirects denied
  - response size cap enforced
