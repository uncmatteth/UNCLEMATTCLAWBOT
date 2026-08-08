# PROJECT_TRUTH_AUDIT

Audit date: 2026-08-08 America/New_York  
Repository: `uncmatteth/UNCLEMATTCLAWBOT`  
Default branch: `main`  
Audited base: `34fe27d12f180e2e307ab11cd1579c6bfaa3df41`  
Work branch: `webchatgpt/tommy-launch-20260808`

## Scope

This audit covers the Uncle Matt broker, OpenClaw extension and skill copies, installer templates, security defaults, tests, package/version identity, release-bundle script, and current GitHub release evidence.

It does not install OpenClaw, Docker, certificates, secrets, the broker, or the plugin; run external API actions; alter security policy; publish to ClawHub/npm/GitHub Releases; download or execute release assets; expose keys; or claim a clean-host installation.

## Baseline

- Authenticated remote `main` is `34fe27d12f180e2e307ab11cd1579c6bfaa3df41`.
- No root `AGENTS.md` exists.
- Root `VERSION`, README, broker package, and OpenClaw extension package all declare source version `5.420.69`.
- The broker is a private Node/TypeScript package with a lockfile and build/test scripts.
- Source contains fail-closed configuration, mTLS, allow-list, private-network guard, redaction, rate/budget, response-cap, plugin, installer, prompt-injection, sandbox, and secret-audit test surfaces.
- The authenticated GitHub `latest` release is still `v0.69.0`, published 2026-02-02, with `uncle-matt-0.69.0.tgz` and `uncle-matt-broker-0.69.0.tar`. It does not bind the current `5.420.69` source head.
- The environment lacks an authenticated executable checkout, Docker, OpenClaw, gitleaks, TruffleHog, Node dependency installation, and clean-host VMs. GitHub Actions are prohibited.

## Coverage Ledger

| Area | Current evidence | Strength | Status |
|---|---|---:|---|
| Source version identity | `VERSION`, README, broker package, extension package | `STATIC_ONLY` | `VERIFIED` |
| Broker package/lock/build/tests | current source tree | `STATIC_ONLY` | `PARTIAL` |
| Security policy and network guards | source/config/tests exist | `STATIC_ONLY` | `PARTIAL` |
| OpenClaw extension source and committed JS | `index.ts`, `index.js`, plugin manifest/package | `STATIC_ONLY` | `PARTIAL` |
| Standalone/nested skill parity | README, SKILL, ACTIONS blobs are byte-identical | `EXECUTED_LIMITED` | `VERIFIED` |
| Voice-pack parity | `VOICE_PACK.md` exists only in standalone skill tree | `STATIC_ONLY` | `PARTIAL` |
| Broker/default installer action template parity | identical Git blob SHA | `EXECUTED_LIMITED` | `VERIFIED` |
| Release-bundle script | source-controlled script reads root `VERSION` | `STATIC_ONLY` | `PARTIAL` |
| Current GitHub release/source parity | latest release is `v0.69.0`, source is `5.420.69` | `EXECUTED_LIMITED` | `CONTRADICTED` |
| Release artifact reproducibility/checksums | current `5.420.69` assets absent | `MISSING` | `UNKNOWN` |
| Clean Linux/macOS/Windows install/upgrade | installers exist; runtime proof unavailable | `BLOCKED` | `UNKNOWN` |
| Secret/security scanning | config/test scripts exist; tools unavailable | `BLOCKED` | `UNKNOWN` |

## Proof Ledger

### Version facts

Current source:

```text
VERSION: 5.420.69
README title: v5.420.69
broker/package.json: 5.420.69
openclaw/extensions/uncle-matt/package.json: 5.420.69
```

Current authenticated latest release:

```text
tag: v0.69.0
published: 2026-02-02
asset: uncle-matt-0.69.0.tgz
asset SHA-256: c419c12ca378445ddca776795755e14d4fab2bd060757ce1346f7a20b929cf6f
asset: uncle-matt-broker-0.69.0.tar
asset SHA-256: ac06ec975e623db09fbdb3cd67e4eb1585acfb84a66fd5753851dcd04512cad8
```

The release's target branch label is `main`, but no current evidence ties either artifact to `34fe27d...`, and their version identifiers do not match current source.

### Source/generated-copy facts

The recursive Git tree proves:

- `openclaw/skills/uncle-matt/ACTIONS.generated.md` and the nested extension copy share blob `0631505...`;
- both skill `README.md` copies share blob `572d859...`;
- both skill `SKILL.md` copies share blob `9680d386...`;
- `broker/config/actions.default.json` and `installer/templates/broker.actions.example.json` share blob `86d7551...`;
- standalone `VOICE_PACK.md` is not duplicated under the nested skill;
- `index.ts` and committed `index.js` are different source/generated artifacts, but no current deterministic build/parity command was established from the inspected package.

### Packaging facts

`scripts/package-release.sh`:

- reads root `VERSION`;
- writes `_artifacts/release/uncle-matt-<version>.tgz`;
- excludes Git metadata, `_artifacts`, dependencies, `dist`, certificates, environment files, and common private-key formats;
- packages README, license, version, gitleaks config, Compose, broker, OpenClaw, installer, docs, tests, and scripts.

The script does not itself create a checksum manifest, source-commit manifest, SBOM, provenance attestation, signature, or two-build reproducibility comparison.

### Required native proof — blocked here

```bash
cd broker
npm ci
npm run build
npm test
cd ..
./scripts/validate-actions.sh
bash tests/integration/audit_must_pass.test.sh
bash tests/integration/openclaw_tool_policy.test.sh
bash tests/integration/prompt_injection_suite.test.sh
bash tests/integration/sandbox_no_egress.test.sh
gitleaks detect --source . --no-banner
trufflehog filesystem . --no-update
./scripts/package-release.sh
sha256sum _artifacts/release/uncle-matt-5.420.69.tgz
```

Release acceptance additionally requires rebuilding twice from clean clones, comparing unpacked trees and hashes, verifying committed `index.js` from `index.ts`, validating the package under the declared OpenClaw compatibility version, and performing fresh Linux/macOS/Windows install, restart, upgrade, rollback, uninstall, and failure-path tests without exposing secrets.

## Findings

### UM-001 — Current source version is internally consistent

Status: `VERIFIED`  
Severity: medium

The four inspected current source/version declarations agree on `5.420.69`.

### UM-002 — Published release is stale and not current-source proof

Status: `CONTRADICTED`  
Severity: critical

GitHub's latest public release is `v0.69.0`, not `5.420.69`. Its two assets cannot be presented as current install artifacts for this source head. A new release must be created only after current native/security/clean-host gates pass and its artifacts are bound to the exact commit.

### UM-003 — Core duplicate source copies are currently byte-identical

Status: `VERIFIED`  
Severity: medium

The standalone and nested skill README/SKILL/action files share exact Git blobs, and the installer action template shares the broker default-action blob. This is strong source parity for those files.

### UM-004 — Generated extension parity is not enforced

Status: `PARTIAL`  
Severity: high

Both TypeScript and committed JavaScript extension entrypoints exist, while the extension package points OpenClaw at `index.js`. No current package build/test command or committed parity check proves `index.js` was generated from the inspected `index.ts` and matches its behavior.

### UM-005 — Voice-pack packaging semantics need explicit proof

Status: `PARTIAL`  
Severity: medium

The standalone skill contains the advertised voice pack, while the nested extension skill copy does not. That may be intentional if the extension resolves the standalone file, but clean installs from each supported artifact must prove voice-pack availability, default-off behavior, exact 420-line count, and failure behavior.

### UM-006 — Security architecture is substantial but unexecuted

Status: `PARTIAL`  
Severity: high

Current source has mTLS, allow-list, private-address blocking, caller-header restrictions, redirect controls, redaction, budgets/rate limits, response caps, sandbox policies, and injection tests. No current compile/test/container/network/security-scan output is available at the audited SHA.

### UM-007 — Install and upgrade claims remain external

Status: `BLOCKED`  
Severity: high

The scripts cannot be accepted as one-click or release-ready without clean-host tests across supported operating systems, OpenClaw compatibility, Docker/secrets variations, partial failure, rerun/idempotency, upgrade, rollback, uninstall, certificate rotation, and preexisting-configuration preservation.

## Truth Table

| Claim | Current truth | Classification |
|---|---|---|
| Current source version is `5.420.69` | supported by four files | `VERIFIED` |
| Latest release is `5.420.69` | false; latest is `v0.69.0` | `CONTRADICTED` |
| Current release assets prove this source head | false | `CONTRADICTED` |
| Duplicate skill/action copies currently match | supported by Git blob equality | `VERIFIED` |
| Committed `index.js` matches `index.ts` | not proved | `UNKNOWN` |
| Broker/security tests currently pass | not executed | `UNKNOWN` |
| Clean-host installers currently pass | not executed | `UNKNOWN` |
| This branch installed, published, or changed security behavior | false | `VERIFIED` |

## Investigated And Rejected

- Rejected treating `v0.69.0` assets as current `5.420.69` artifacts.
- Rejected changing version identifiers to match a stale release.
- Rejected publishing a release or ClawHub/npm package.
- Rejected generating certificates, secrets, or live action configuration.
- Rejected running a broker or making API calls.
- Rejected modifying security behavior without executable tests.
- Rejected equating gitleaks configuration with a completed gitleaks/TruffleHog scan.
- Rejected GitHub Actions as a proof substitute.

## Unknowns And Blockers

- Current dependency install, TypeScript build, broker tests, integration tests, and scanners.
- Exact `index.ts` to `index.js` generation/parity path.
- Voice-pack line count and availability in every installation form.
- Docker image source/SBOM/signature/provenance and runtime hardening.
- Clean-host Linux/macOS/Windows installer, rerun, upgrade, rollback, uninstall, certificate rotation, and OpenClaw compatibility.
- Current `5.420.69` release archive, checksum manifest, source commit, reproducibility, signature, and publication.
- Human review of security policy, defaults, documentation, and recovery behavior.

## Next Proof Steps

```bash
git -C /home/Tommy/Documents/GitHub/UNCLEMATTCLAWBOT fetch origin webchatgpt/tommy-launch-20260808
git -C /home/Tommy/Documents/GitHub/UNCLEMATTCLAWBOT log --oneline --decorate -1 FETCH_HEAD
git -C /home/Tommy/Documents/GitHub/UNCLEMATTCLAWBOT diff --stat 34fe27d12f180e2e307ab11cd1579c6bfaa3df41..FETCH_HEAD
```

After preserving local work, run the blocked gate set in an isolated checkout, add deterministic extension-source parity and release provenance checks if missing, perform clean-host install/upgrade/rollback tests, and only then publish source-bound `5.420.69` artifacts.
