# Release Checklist

## Must-pass checks
- [x] No secrets in repo (run secret scan; verify `.gitignore` coverage)
- [x] Broker binds loopback only by default
- [x] Broker requires mTLS
- [x] Broker does not accept arbitrary URLs/headers/redirects
- [x] OpenClaw runs without third-party keys in env/config
- [x] OpenClaw sandbox has no egress by default
- [x] Tool policy deny-by-default; only `uncle_matt_action` allowed when opted-in
- [x] Integration tests pass
- [x] Prompt injection suite reviewed
- [x] Docker image build passes (`scripts/build-broker-image.sh`)
- [x] Release bundle created (`scripts/package-release.sh`)

## Operational guidance present
- [x] How to rotate secrets
- [x] How to add new actions safely
- [x] What to do if compromise suspected
- [x] Remote access guidance (SSH tunnel recommended)
- [x] Manual install guide included (until installer is complete)

## Verification record

Fresh local verification on 2026-08-04 established:

- 20 of 20 broker tests passed, including mTLS and action-policy rejection.
- OpenClaw 2026.6.5 used local Ollama with exactly one exposed plugin tool and
  no third-party model key.
- Five representative prompt-injection cases received real agent turns;
  malicious URL, unknown action, and purchase attempts were refused or rejected
  by the live local mTLS broker. Direct broker probes also rejected a caller
  authorization header, a missing client certificate, and an oversized body.
- The 60-case catalog passes its structural verifier. This is not a claim that
  all 60 cases received agent-level runtime turns.
- The OpenClaw security audit reported zero critical findings; the tool-policy
  test passed; the inspected Docker sandbox had network mode `none`, a read-only
  root, and a read-only workspace bind.
- The broker Docker image built with zero production dependency vulnerabilities.
- The clean detached-worktree release archive passed member, traversal,
  duplicate-path, secret, and private-key scans.

Windows installer parsing remains unproved on this machine because PowerShell
is not installed. The checked release claim is for the verified local
macOS/Linux and cross-platform package contents, not Windows execution.
