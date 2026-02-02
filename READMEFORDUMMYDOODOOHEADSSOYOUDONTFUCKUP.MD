# Uncle Matt: For Dummies (Do Not Screw This Up Edition)

This is the simplest possible guide. If you follow this exactly, it should work.

## TL;DR Quick Start (copy/paste)
### Mac / Linux
```bash
cd /path/to/UNCLEMATTCLAWBOT
./installer/setup.sh
```

### Windows (PowerShell)
```powershell
cd C:\path\to\UNCLEMATTCLAWBOT
.\installer\setup.ps1
```

If that finishes without errors, you are done. Everything else below is for when you want to add actions, add secrets, or fix issues.

## If you are on Windows (read this once)
- Use PowerShell (not cmd.exe).
- Use `curl.exe` (PowerShell aliases `curl` to Invoke-WebRequest).
- If `openssl` is missing, install OpenSSL or use WSL.
- If Docker Desktop is installed, make sure it is running.

## What this thing does (in plain English)
- It keeps your API keys OUT of OpenClaw.
- The agent can only call **pre-approved actions**, not random URLs.
- A local Broker does the real API call and injects secrets safely.
- It uses **mTLS** so only your local OpenClaw can talk to the Broker.

If the agent gets prompt-injected, it still can not exfiltrate secrets or act as an open proxy.

## You will need
- OpenClaw installed and working
- Docker installed and running
- OpenSSL installed
- A terminal (PowerShell on Windows, bash on Mac/Linux)

## Preflight check (optional, but recommended)
### Mac / Linux
```bash
openclaw --version
docker --version
docker info
openssl version
```

### Windows (PowerShell)
```powershell
openclaw --version
docker --version
docker info
openssl version
```

## Step 0: Decide how you will store secrets
**Recommended (easy + safe): Docker Swarm secrets**
- One-time setup:
  - `docker swarm init`

**Alternate (less safe, manual): local secrets folder**
- This stores keys in files on disk. You must protect that folder.
- Only use this if you refuse to enable Swarm.

## Step 1: Run the installer (this is the easiest path)
### Mac / Linux
```bash
cd /path/to/UNCLEMATTCLAWBOT
./installer/setup.sh
```

### Windows (PowerShell)
```powershell
cd C:\path\to\UNCLEMATTCLAWBOT
.\installer\setup.ps1
```

The installer:
- Generates TLS certs
- Copies the OpenClaw extension
- Configures OpenClaw safe defaults
- Validates your actions config
- Builds + starts the Broker
- Generates `openclaw/skills/uncle-matt/ACTIONS.generated.md`

## Where files live (so you are not lost)
- Actions file: `broker/config/actions.default.json`
- Broker config schema: `broker/config/actions.schema.json`
- Redaction patterns: `broker/config/log-redact.patterns.json`
- Generated certs (default): `~/.secure-openclaw/certs/`
- OpenClaw extension install path (default): `~/.openclaw/extensions/uncle-matt/`
- Docker Compose file: `docker-compose.yml`

## Step 2: Define actions (this is the only part you usually edit)
Actions live in:
- `broker/config/actions.default.json`

**Rule:** Do NOT put secrets in this file.

Example (simple GET):
```json
{
  "actions": {
    "demo_ping": {
      "upstream": {
        "host": "example.com",
        "path": "/"
      },
      "method": "GET",
      "pathAllowlist": ["/"],
      "request": {
        "maxBodyBytes": 1024,
        "allowedContentTypes": ["application/json"]
      },
      "auth": { "kind": "none" },
      "rateLimit": { "maxRequests": 10, "windowSeconds": 60 },
      "budget": { "maxRequests": 1000, "windowSeconds": 86400 },
      "limits": { "maxResponseBytes": 50000, "maxInFlight": 4 }
    }
  }
}
```

**Important rules:**
- **host must NOT contain a colon.** If you need a non-443 port, use `upstream.port`.
  - Example: `{ "host": "api.example.com", "port": 8443, "path": "/v1/foo" }`
- Every action must have rateLimit, budget, and limits.
- Paths must be allowlisted or the Broker will refuse to run.

After editing actions:
```bash
./scripts/validate-actions.sh
```
If it says “Actions config OK”, you are good.

## Step 3: Create secrets (only if your action uses auth)
If your action has `auth.kind` of `bearer` or `header`, you need secrets.

### Option A: Docker Swarm (recommended)
```bash
docker secret create OPENAI_API_KEY ./secrets/openai.key
```
Then re-run the installer or restart the broker:
```bash
docker compose up -d --build
```

### Option B: Local secrets folder (manual)
- Create a folder: `broker/secrets/`
- Add files:
  - `broker/secrets/OPENAI_API_KEY`
  - (one file per secret)
- Update `docker-compose.yml` to mount it:
  - `./broker/secrets:/run/secrets:ro`
- Restart broker

## Step 4: Use it
In OpenClaw, you now have the tool:

`uncle_matt_action(actionId, json)`

Example call:
```json
{
  "actionId": "demo_ping",
  "json": {}
}
```

The agent cannot call arbitrary URLs. It can only call your action IDs.

## Step 5: Verify it works (quick checks)
### Check the Broker is running
```bash
docker ps
```

### Check Broker health (Mac/Linux)
```bash
curl --cacert ~/.secure-openclaw/certs/ca.crt \
  --cert ~/.secure-openclaw/certs/client.crt \
  --key ~/.secure-openclaw/certs/client.key \
  https://127.0.0.1:8443/healthz
```
Expected output: `{"ok":true}`

### Check Broker health (Windows PowerShell)
```powershell
curl.exe --cacert "$HOME\\.secure-openclaw\\certs\\ca.crt" `
  --cert "$HOME\\.secure-openclaw\\certs\\client.crt" `
  --key "$HOME\\.secure-openclaw\\certs\\client.key" `
  https://127.0.0.1:8443/healthz
```

### Check actions list (Mac/Linux)
```bash
curl --cacert ~/.secure-openclaw/certs/ca.crt \
  --cert ~/.secure-openclaw/certs/client.crt \
  --key ~/.secure-openclaw/certs/client.key \
  https://127.0.0.1:8443/v1/actions
```

If those work, OpenClaw can talk to the Broker.

## How to change actions later (safe way)
1) Edit `broker/config/actions.default.json`
2) Validate:
   ```bash
   ./scripts/validate-actions.sh
   ```
3) Restart broker:
   ```bash
   docker compose up -d --build
   ```

## Common errors and the exact fix
- **"Actions config invalid"**
  - Run `./scripts/validate-actions.sh` and fix the printed errors.
  - Most common cause: missing `rateLimit`/`budget`/`limits`.
- **"Missing required secrets in /run/secrets"**
  - You defined `auth.secretRef` but did not create Docker secrets.
  - Fix: `docker secret create NAME ./file` or use local secrets dir.
- **Broker starts, but OpenClaw can’t connect**
  - Check cert paths in OpenClaw config.
  - Use the health check curl command above.
- **"upstream_private_address_blocked"**
  - Your action points to a private or local IP. This is blocked by design.
  - Fix: use a public host, or set `BROKER_ALLOW_PRIVATE_IPS=1` (unsafe).
- **I changed actions and nothing happens**
  - Restart broker: `docker compose up -d --build`

## Safe defaults explained (why it is strict)
- Broker only allows fixed action IDs, not arbitrary URLs.
- Caller auth headers are blocked so the agent can’t smuggle secrets.
- Redirects are blocked so the upstream can’t bounce to a different host.
- Private IPs are blocked to avoid local network exfiltration.
- Request/response size caps prevent data exfiltration and runaway payloads.

## Safety checklist (DO THIS)
- Keep Broker bound to localhost (default is safe)
- Never expose Broker to the public internet
- Never put secrets in `actions.default.json`
- Keep `log-redact.patterns.json` mounted (required)
- Do not use test certs in production

## Things you should NEVER do
- Do NOT put an API key in any JSON config file.
- Do NOT expose port 8443 to the internet.
- Do NOT allow private IPs unless you know exactly why.

## Troubleshooting (simple fixes)
- **Installer says actions config invalid**
  - Run `./scripts/validate-actions.sh` and fix the errors it prints.
- **Broker won’t start**
  - Missing secrets or redaction patterns. Check `/run/secrets` and `broker/config/log-redact.patterns.json`.
- **OpenClaw can’t talk to Broker**
  - Make sure cert paths in OpenClaw config are correct.
  - Make sure Broker is running: `docker ps`.
- **I changed actions but nothing happens**
  - You must restart the Broker: `docker compose up -d --build`
- **I don’t know where OpenClaw config is**
  - Run: `openclaw config get --json` and search for `plugins.entries.uncle-matt`

## Minimal “safe” action template (copy/paste)
```json
{
  "actions": {
    "my_action": {
      "upstream": {
        "host": "api.example.com",
        "path": "/v1/endpoint"
      },
      "method": "POST",
      "pathAllowlist": ["/v1/endpoint"],
      "request": {
        "maxBodyBytes": 1024,
        "allowedContentTypes": ["application/json"]
      },
      "auth": { "kind": "bearer", "secretRef": "OPENAI_API_KEY" },
      "rateLimit": { "maxRequests": 30, "windowSeconds": 60 },
      "budget": { "maxRequests": 5000, "windowSeconds": 86400 },
      "limits": { "maxResponseBytes": 50000, "maxInFlight": 4 }
    }
  }
}
```

## How to rotate secrets (safe method)
1) Create a new Docker secret with the new value.
2) Update your action to reference the new secret name if needed.
3) Restart the Broker.

## How to uninstall / reset
### Stop broker
```bash
docker compose down
```

### Remove the extension
Delete the folder at `~/.openclaw/extensions/uncle-matt/` (or the path shown in `openclaw config get plugins.load.paths --json`)

### Optional: remove certs
Delete `~/.secure-openclaw/certs/` (only if you are sure you do not need them).

## FAQ
**Q: Do end users need to run tests?**
A: No. Tests are for maintainers/CI. Installer is enough for users.

**Q: Can I add more actions later?**
A: Yes. Edit `actions.default.json`, validate, restart broker.

**Q: Why is this so strict?**
A: Because prompt injection is real. The point is to reduce damage even if the agent is compromised.

**Q: What if I do not want Docker Swarm?**
A: Use the local secrets folder option, but secure that folder. It stores keys as plain files.

**Q: Can I run the Broker on another machine?**
A: Not recommended. This is designed for local loopback mTLS only.

## If you only remember one thing
Do NOT put secrets in config files. The Broker reads secrets from Docker secrets.
