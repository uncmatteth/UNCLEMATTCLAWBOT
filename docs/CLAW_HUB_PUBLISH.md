# ClawHub Publish (Prep)

## TL;DR
```bash
clawhub publish ./openclaw/skills/uncle-matt \
  --slug uncle-matt \
  --name "Uncle Matt" \
  --version 3.420.70 \
  --tags "latest,security,safety,broker,mtls,prompt-injection,anti-prompt-injection,openclaw,uncle matt,tool-safety,api-proxy,guardrails,hardening,no-secrets,secret-guard,damage-control" \
  --changelog "3.420.70: updates ClawHub-facing documentation, keeps the plugin-local skill layout compatible with current OpenClaw builds, and reinforces the no-secrets, no-arbitrary-URL, no-open-proxy broker safety model."
```

This guide prepares the Uncle Matt skill for publishing to the OpenClaw public skill registry.

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
From the repo root (this is the only command you need if already logged in):

```bash
clawhub publish ./openclaw/skills/uncle-matt \
  --slug uncle-matt \
  --name "Uncle Matt" \
  --version 3.420.70 \
  --tags "latest,security,safety,broker,mtls,prompt-injection,anti-prompt-injection,openclaw,uncle matt,tool-safety,api-proxy,guardrails,hardening,no-secrets,secret-guard,damage-control" \
  --changelog "3.420.70: updates ClawHub-facing documentation, keeps the plugin-local skill layout compatible with current OpenClaw builds, and reinforces the no-secrets, no-arbitrary-URL, no-open-proxy broker safety model."
```

If your install uses `clawdhub` instead of `clawhub`, replace `clawhub` with `clawdhub`.

## Optional: Sync (scan + publish updates)
```bash
clawhub sync --all
```

## Notes
- `clawhub publish` (or `clawdhub publish`) creates a new semver version per publish.
- Tags (like `latest`) can move between versions to roll back if needed.
- If you prefer a non-interactive flow, use `--no-input` and provide `--changelog`.
