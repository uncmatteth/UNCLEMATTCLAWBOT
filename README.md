# Uncle Matt — Secure OpenClaw Wrapper (v0.1)

**Uncle Matt** is a secure-by-default add-on architecture for **OpenClaw** that aims to stop secrets from getting leaked and to reduce damage from prompt injection/tool abuse.

## ⚠️ Why your setup might fail (on purpose)
If the Broker refuses to start, that is **intentional** safety enforcement. Most common reasons:
- Missing secrets in `/run/secrets` (or `BROKER_SECRET_DIR`) for any `auth.secretRef`.
- Missing/empty redaction patterns file (`/config/log-redact.patterns.json`).
- Action config points at private/localhost/metadata IPs (now blocked by default).

See `docs/INSTALL.md` and `docs/CONFIGURATION.md` for the exact requirements and overrides.

![I have no idea what I'm doing GIF](https://media1.tenor.com/m/UMv5aynvQKwAAAAd/i-have-no-idea-no-idea-what-im-doing.gif)

## Description
Uncle Matt is your favorite internet uncle who stops you from doing really stupid shit. He routes API calls through a hardened local Broker so your secrets don't leak and random outbound requests get blocked.

A hardened local Broker tool that prevents secret leakage and blocks arbitrary outbound requests.

Uncle Matt sits between the agent and the internet. The agent never gets API keys. It can only call action IDs. The Broker injects secrets server-side, blocks redirects and caller-supplied auth headers, caps responses, and refuses anything that is not allowlisted. If the agent is prompt-injected or behaves badly, it still cannot exfiltrate secrets or act as an open proxy.

Technical description: Uncle Matt is an OpenClaw extension that registers an optional tool `uncle_matt_action(actionId, json)`. The tool connects to a local Broker over mTLS. The Broker is the only component that holds third-party API keys (via Docker secrets) and enforces allowlists (host/path/method/content-type), denies redirects and caller auth headers, caps request/response sizes, and applies logging redaction. OpenClaw is configured with a restrictive tool policy and sandbox network `none` by default.

Optional voice pack: If you enable it, Uncle Matt can prepend short, profane refusal/warning lines. It is off by default and only intended for safety messages.

## !!! VOICE PACK !!! 😎👍
Want Uncle Matt to talk back like a profane internet uncle? Turn it on.  
It includes **420** random refusal/warning lines.  
Enable by setting `voicePackEnabled: true` in the plugin config.

## By / Contact
By Uncle Matt.  
X (Twitter): `x.com/unc_matteth`  
Website: `bobsturtletank.fun`
Buy me a coffee: `buymeacoffee.com/unclematt`

You install OpenClaw separately (per OpenClaw docs). This repo provides:

- A hardened **Broker** (secrets proxy) service that holds third‑party API keys.
- An OpenClaw **extension/plugin** that exposes a single optional tool: `uncle_matt_action`.
- Safe configuration templates + an installer to set up mTLS, Docker secrets, and loopback-only networking.
- A test suite and a prompt-injection attempt pack to verify the guardrails.

## Quick start (high level)
1. Install OpenClaw (follow upstream docs).
2. Install Docker.
3. Run the installer:
   - Windows: `installer/setup.ps1`
   - macOS/Linux: `installer/setup.sh`

## Quick install (local)
macOS/Linux:
```bash
git clone https://github.com/uncmatteth/UNCLEMATTCLAWBOT.git
cd UNCLEMATTCLAWBOT
./installer/setup.sh
```

Windows (PowerShell):
```powershell
git clone https://github.com/uncmatteth/UNCLEMATTCLAWBOT.git
cd UNCLEMATTCLAWBOT
powershell -ExecutionPolicy Bypass -File installer/setup.ps1
```

## Getting started (detailed)
- Install guide: `docs/INSTALL.md`
- Configure OpenClaw + the Broker: `docs/CONFIGURATION.md`
- Common issues + fixes: `docs/TROUBLESHOOTING.md`
- Prebuilt artifacts: `docs/RELEASE_ASSETS.md`

## Design intent
- **OpenClaw must never hold long-lived third-party API keys.**
- **OpenClaw sandbox has no outbound internet by default.**
- Only the **Broker** has internet egress, and it exposes **action-based** APIs (no arbitrary URLs).
- OpenClaw talks to Broker over **mTLS** (client certificate required).

See `/docs/` for the full architecture and roadmap.

## Repository map
- `/docs/` — architecture, roadmap, operator guide, install/config notes
- `/broker/` — the secrets proxy (mTLS + allowlists + budgets)
- `/openclaw/` — extension + skill docs/config templates
- `/installer/` — one-click-ish setup scripts (certs, docker secrets, config patch)
- `/tests/` — integration checks + prompt injection suite

## Docs index
- `docs/00_OVERVIEW.md`
- `docs/01_ARCHITECTURE.md`
- `docs/04_BROKER_SPEC.md`
- `docs/05_UNCLE_MATT_PLUGIN_SKILL.md`
- `docs/06_INSTALLER_SPEC.md`
- `docs/07_TESTING.md`
- `docs/09_OPENCLAW_COMPAT.md`
- `docs/10_IMPLEMENTATION_PLAN.md`
- `docs/INSTALL.md`
- `docs/CONFIGURATION.md`
- `docs/TROUBLESHOOTING.md`
- `docs/OPTIONAL_UPDATE.md`
- `docs/RELEASE_ASSETS.md`
- `docs/CLAW_HUB_PUBLISH.md`
