# ClawHub Publish (Prep)

## TL;DR
```bash
clawhub publish ./openclaw/skills/uncle-matt \
  --slug uncle-matt \
  --name "Uncle Matt" \
  --version 2.420.69 \
  --tags latest \
  --changelog "2.420.69: skill page links to repo/guides, fixed plugin skill path, aligned config docs, broker deps security update"
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
  --version 2.420.69 \
  --tags latest \
  --changelog "2.420.69: skill page links to repo/guides, fixed plugin skill path, aligned config docs, broker deps security update"
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
