# ClawHub Publish (Prep)

## TL;DR

Publish the public skill page:

```bash
clawhub publish ./openclaw/skills/uncle-matt \
  --slug uncle-matt \
  --name "Uncle Matt" \
  --version 4.20.69 \
  --tags "latest,security,safety,broker,mtls,prompt-injection,anti-prompt-injection,openclaw,uncle matt,tool-safety,api-proxy,guardrails,hardening,no-secrets,secret-guard,damage-control" \
  --changelog "4.20.69: updates ClawHub-facing documentation, keeps the plugin-local skill layout compatible with current OpenClaw builds, and reinforces the no-secrets, no-arbitrary-URL, no-open-proxy broker safety model."
```

Publish the installable OpenClaw code plugin:

```bash
clawhub package publish openclaw/extensions/uncle-matt \
  --family code-plugin \
  --name @uncmatteth/uncle-matt-openclaw-extension \
  --display-name "Uncle Matt OpenClaw Extension" \
  --version 4.20.69 \
  --tags "latest,security,safety,broker,mtls,prompt-injection,anti-prompt-injection,openclaw,uncle matt,tool-safety,api-proxy,guardrails,hardening,no-secrets,secret-guard,damage-control" \
  --changelog "4.20.69: updates Uncle Matt for OpenClaw 2026.5 plugin metadata, publishes the runtime tool contract, and keeps voice-pack config/schema compatible."
```

This guide prepares both the Uncle Matt skill page and installable OpenClaw code plugin for ClawHub.

Note: If you already have `clawhub` installed, you can skip straight to “Quick publish”.

## Prereqs
- `openclaw/skills/uncle-matt/SKILL.md` contains YAML frontmatter (name + description at minimum).
- The skill folder contains only safe, non-secret files.

## Install the CLI (if needed)
Use one of the official options:

```bash
npm i -g clawhub
```

```bash
pnpm add -g clawhub
```

## Login (once)
```bash
clawhub login
clawhub whoami
```

## Quick publish (copy/paste)
From the repo root, publish the skill page:

```bash
clawhub publish ./openclaw/skills/uncle-matt \
  --slug uncle-matt \
  --name "Uncle Matt" \
  --version 4.20.69 \
  --tags "latest,security,safety,broker,mtls,prompt-injection,anti-prompt-injection,openclaw,uncle matt,tool-safety,api-proxy,guardrails,hardening,no-secrets,secret-guard,damage-control" \
  --changelog "4.20.69: updates ClawHub-facing documentation, keeps the plugin-local skill layout compatible with current OpenClaw builds, and reinforces the no-secrets, no-arbitrary-URL, no-open-proxy broker safety model."
```

If your install uses `clawdhub` instead of `clawhub`, replace `clawhub` with `clawdhub`.

Then publish the code plugin package:

```bash
clawhub package publish openclaw/extensions/uncle-matt \
  --family code-plugin \
  --name @uncmatteth/uncle-matt-openclaw-extension \
  --display-name "Uncle Matt OpenClaw Extension" \
  --version 4.20.69 \
  --tags "latest,security,safety,broker,mtls,prompt-injection,anti-prompt-injection,openclaw,uncle matt,tool-safety,api-proxy,guardrails,hardening,no-secrets,secret-guard,damage-control" \
  --changelog "4.20.69: updates Uncle Matt for OpenClaw 2026.5 plugin metadata, publishes the runtime tool contract, and keeps voice-pack config/schema compatible."
```

## Optional: Sync (scan + publish updates)
```bash
clawhub sync --all
```

## Notes
- `clawhub publish` creates a new skill-page semver version per publish.
- `clawhub package publish` creates a new installable code-plugin version per publish.
- Tags (like `latest`) can move between versions to roll back if needed.
- If you prefer a non-interactive flow, use `--no-input` and provide `--changelog`.
