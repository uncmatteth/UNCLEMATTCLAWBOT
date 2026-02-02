# Uncle Matt Plugin + Skill

## What it is
- **Plugin/Extension:** registers the tool `uncle_matt_action`
- **Skill docs:** teach the agent how to use the tool safely

## Branding
Name: **Uncle Matt**  
Description (fun): "Uncle Matt is your favorite internet uncle who stops you from doing really stupid shit. He routes API calls through a hardened local Broker so your secrets don't leak and random outbound requests get blocked."

Description (short technical): "A hardened local Broker tool that prevents secret leakage and blocks arbitrary outbound requests."

Description (long form, plain English): "Uncle Matt sits between the agent and the internet. The agent never gets API keys. It can only call action IDs. The Broker injects secrets server-side, blocks redirects and caller-supplied auth headers, caps responses, and refuses anything that is not allowlisted. If the agent is prompt-injected or behaves badly, it still cannot exfiltrate secrets or act as an open proxy."

Description (technical): "Uncle Matt is an OpenClaw extension that registers an optional tool `uncle_matt_action(actionId, json)`. The tool connects to a local Broker over mTLS. The Broker is the only component that holds third-party API keys (via Docker secrets) and enforces allowlists (host/path/method/content-type), denies redirects and caller auth headers, caps request/response sizes, and applies logging redaction. OpenClaw is configured with a restrictive tool policy and sandbox network `none` by default."

## Tool
Name: `uncle_matt_action` (optional tool)

Input:
- `actionId: string`
- `json: object`

Rules:
- tool never accepts URL/host/headers from caller
- tool calls only `POST /v1/action/:id` on local broker over mTLS
- output size capped (avoid data exfil channels)

## Skill docs
File: `/openclaw/skills/uncle-matt/SKILL.md`

Must include:
- purpose and rules
- “only allowed path to external APIs”
- response behavior when action missing: propose action requirements, do not invent.

Installer generates:
- `ACTIONS.generated.md` listing available action IDs.

## Optional voice pack (off by default)
!!! VOICE PACK !!! 😎👍
Includes **420** random refusal/warning lines.
File: `/openclaw/skills/uncle-matt/VOICE_PACK.md`

Rules:
- Only use when `voicePackEnabled: true` or the operator explicitly enables it.
- Only for refusals/warnings (not normal task responses).
