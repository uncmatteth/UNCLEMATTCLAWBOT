# ClawHub Publish (Prep)

This guide prepares the Uncle Matt skill for publishing to the OpenClaw public skill registry.\n+\n+Note: The official docs currently reference both **ClawHub** and **ClawdHub**. Use the CLI that matches your install (`clawhub` or `clawdhub`). The commands are identical other than the binary name.

## Prereqs
- `openclaw/skills/uncle-matt/SKILL.md` contains YAML frontmatter (name + description at minimum).
- The skill folder contains only safe, non-secret files.

## Install the CLI
Use one of the official options (replace `clawhub` with `clawdhub` if that is the CLI you installed):

```bash
npm i -g clawhub
```

```bash
pnpm add -g clawhub
```

## Login
```bash
clawhub login
clawhub whoami
```

Alternative (if you installed ClawdHub):

```bash
clawdhub login
clawdhub whoami
```

## Publish this skill
From the repo root:

```bash
clawhub publish ./openclaw/skills/uncle-matt \
  --slug uncle-matt \
  --name "Uncle Matt" \
  --version 1.420.69 \
  --tags latest \
  --changelog "Initial release"
```

Alternative (if you installed ClawdHub):

```bash
clawdhub publish ./openclaw/skills/uncle-matt \
  --slug uncle-matt \
  --name "Uncle Matt" \
  --version 1.420.69 \
  --tags latest \
  --changelog "Initial release"
```

## Optional: Sync (scan + publish updates)
```bash
clawhub sync --all
```

Alternative (if you installed ClawdHub):

```bash
clawdhub sync --all
```

## Notes
- `clawhub publish` (or `clawdhub publish`) creates a new semver version per publish.
- Tags (like `latest`) can move between versions to roll back if needed.
- If you prefer a non-interactive flow, use `--no-input` and provide `--changelog`.
