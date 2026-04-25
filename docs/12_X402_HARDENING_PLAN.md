# x402 Hardening Plan

Last reviewed against public x402 docs on 2026-03-07.

## What x402 is

x402 is a way for an HTTP server to say:

"This request costs money. Send a valid payment proof and then retry."

The rough flow is:

1. Client sends a normal HTTP request.
2. Server replies `402 Payment Required` with payment requirements.
3. Client creates or gets a payment proof.
4. Client retries with payment headers.
5. Server verifies the payment, settles it, and returns the paid response.

That means x402 is not a vulnerability by itself. The real risk is uncontrolled spending, replayed payments, or letting an LLM trigger payments without strong policy.

## What this project does today

Uncle Matt treats the agent as untrusted.

In simple terms:

- OpenClaw is the brain.
- The Broker is the only part allowed to touch secrets and the internet.
- The agent can only call named actions, not arbitrary URLs.
- The Broker injects auth itself, blocks private network targets, denies redirects, caps request and response sizes, and enforces rate and budget limits.

This is good protection for secrets and prompt-injection abuse.

## What is missing today

This repo does not currently implement x402.

Current gaps:

- No parsing of `402 Payment Required` responses.
- No payment header support.
- No trusted facilitator verification flow.
- No payment idempotency cache.
- No payment-specific spend caps.
- No request-to-payment binding.
- No operator approval flow for larger payments.

If you point the current Broker at an x402-protected API, it will not safely auto-pay it. That is the correct failure mode for now.

## Security goal

Add x402 support without breaking the repo's core rule:

The agent must never be able to turn the Broker into an uncontrolled money-spending proxy.

## Design rules

1. x402 must be explicit per action. No generic "pay any 402" mode.
2. Payment policy must live in Broker config, not in agent prompts.
3. The Broker must only pay when the `402` challenge matches pre-approved terms.
4. Payments must be bound to one exact request shape.
5. Retries must be idempotent.
6. Spending must have per-request and rolling-window caps.
7. The agent must never see wallet secrets or facilitator credentials.
8. Large or unusual payments must require operator approval.

## Plain-English design

For a normal action today, the Broker just forwards a fixed request.

For an x402 action, the Broker should do this instead:

1. Send the request without payment.
2. If the upstream replies `402`, parse the payment challenge.
3. Check that the challenge matches the action policy:
   - same host
   - same path
   - same chain
   - same token
   - same facilitator
   - same payee
   - amount is within limit
4. Create a request fingerprint from method, host, path, query, and body hash.
5. Create or reuse a `payment-identifier` for that exact fingerprint.
6. Ask the configured x402 payer component to produce payment headers.
7. Retry the same request once with those payment headers.
8. Verify the result and store a payment receipt.
9. Return the upstream response to OpenClaw.

If any check fails, the Broker must stop and return an error instead of paying.

## Recommended architecture changes

### 1) Extend action config

Add an optional `payment` section to each action.

Suggested shape:

```json
{
  "payment": {
    "kind": "none"
  }
}
```

or

```json
{
  "payment": {
    "kind": "x402",
    "network": "base",
    "asset": "USDC",
    "maxAmountAtomic": "10000",
    "maxAmountUsd": "0.01",
    "facilitatorBaseUrl": "https://facilitator.example.com",
    "payTo": "0xabc123...",
    "requirePaymentIdentifier": true,
    "maxAutoPayPerWindow": 100,
    "autoPayWindowSeconds": 86400,
    "requireApprovalAboveUsd": "0.10"
  }
}
```

Meaning:

- `kind`: whether the action can ever pay.
- `network`, `asset`, `payTo`, `facilitatorBaseUrl`: pin the allowed challenge.
- `maxAmountAtomic` and `maxAmountUsd`: stop overspend.
- `requirePaymentIdentifier`: require idempotency support.
- `maxAutoPayPerWindow`: count how many paid requests this action may perform.
- `requireApprovalAboveUsd`: manual approval threshold.

### 2) Add a payment engine inside the Broker

Create a small x402 module in the Broker instead of mixing payment logic into the main action handler.

Suggested new files:

- `broker/src/x402/types.ts`
- `broker/src/x402/challenge.ts`
- `broker/src/x402/fingerprint.ts`
- `broker/src/x402/idempotencyStore.ts`
- `broker/src/x402/payer.ts`
- `broker/src/x402/receipts.ts`

Responsibilities:

- `challenge.ts`: parse and validate the `402` challenge.
- `fingerprint.ts`: canonicalize the request and compute a stable fingerprint.
- `idempotencyStore.ts`: persist `payment-identifier` records and prevent duplicate spend.
- `payer.ts`: call the wallet or x402 library and return payment headers.
- `receipts.ts`: persist receipts and settlement metadata for audit.

### 3) Keep secrets out of the agent

Wallet material, payer credentials, and facilitator credentials must live alongside other Broker secrets.

That means:

- read from `BROKER_SECRET_DIR`
- validate presence at startup
- never log them
- never echo them to OpenClaw

### 4) Add manual approval for expensive payments

This repo already assumes dangerous capability should be explicitly gated.

For x402, approval can be simple:

- auto-pay below a configured threshold
- reject above a hard max
- return `payment_approval_required` in the middle band

The first version does not need a full UI. A clean broker error is enough.

### 5) Add durable idempotency

This is mandatory.

Without durable idempotency, a timeout or retry can double-pay.

The Broker should keep a local store keyed by:

- action id
- request fingerprint
- payment identifier
- challenge digest

Suggested first implementation:

- small JSON or SQLite store under a Broker-owned path
- file locking or transactional writes
- receipt retention with TTL

SQLite is the safer long-term option.

### 6) Add payment-aware rate and budget controls

Current rate and budget limiters count requests.

For x402, add separate spend controls:

- max paid requests per window
- max total atomic units per window
- max total USD-equivalent per window
- max concurrent payment settlements

The Broker should refuse a valid `402` challenge if paying it would exceed action budget.

## Exact files to change

### Config and validation

- `broker/config/actions.schema.json`
  Add the `payment` object and validate x402-specific fields strictly.

- `broker/config/actions.default.json`
  Add commented or sample x402 action entries that demonstrate the safe shape.

- `docs/CONFIGURATION.md`
  Document `payment.kind = "x402"` and explain every spend control.

### Broker startup and secrets

- `broker/src/server.ts`
  Extend startup validation so x402 secret refs and required payment config are present before the Broker starts.

- `broker/src/policy.ts`
  Keep schema loading strict and fail closed on unknown x402 config.

### Request handling

- `broker/src/actions/index.ts`
  Split the current direct upstream call path into:
  - normal action flow
  - x402 challenge flow

  This file should only orchestrate the flow. Move x402-specific logic into new helper modules.

- `broker/src/rateLimit.ts`
  Reuse or extend this for spend windows. Counting money and counting requests should stay conceptually separate.

- `broker/src/redact.ts`
  Add patterns for payment headers, wallet artifacts, facilitator tokens, and receipt payloads.

### New broker modules

- `broker/src/x402/challenge.ts`
  Parse payment requirements from the `402` response and validate them against policy.

- `broker/src/x402/fingerprint.ts`
  Canonicalize request body and compute a stable request fingerprint.

- `broker/src/x402/idempotencyStore.ts`
  Prevent duplicate settlement on retries and crashes.

- `broker/src/x402/payer.ts`
  Wrap the actual x402 payment library or wallet integration.

- `broker/src/x402/receipts.ts`
  Persist settlement metadata and expose safe audit information.

- `broker/src/x402/errors.ts`
  Normalize broker-visible errors such as:
  - `x402_not_enabled`
  - `x402_challenge_invalid`
  - `x402_policy_mismatch`
  - `x402_budget_exceeded`
  - `x402_approval_required`
  - `x402_duplicate_payment_prevented`

### OpenClaw plugin

- `openclaw/extensions/uncle-matt/index.ts`
  Keep the tool surface small. Do not expose payment details as user-controlled parameters.

  Optional additions:
  - return a broker error code cleanly when approval is required
  - keep truncation limits strict so payment receipts do not become an exfiltration channel

The plugin should not know how to pay. Payment stays in the Broker.

### Tests

- `broker/test/broker.allowlist.test.ts`
  Add tests for:
  - x402 challenge accepted only when policy matches
  - oversized price rejected
  - wrong payee rejected
  - wrong facilitator rejected
  - duplicate retry does not double-pay
  - approval threshold blocks expensive payment
  - payment headers are redacted from output

- `broker/test/broker.mtls.test.ts`
  No major x402 change, but keep it as a regression gate.

- `tests/integration/openclaw_tool_policy.test.sh`
  Ensure only `uncle_matt_action` remains exposed. x402 support must not add new dangerous agent-facing tools.

- `tests/integration/sandbox_no_egress.test.sh`
  Keep this unchanged. The agent still must not gain direct network access.

- `docs/07_TESTING.md`
  Add x402 replay, overspend, and approval test cases.

## Phased implementation

### Phase 1: Fail closed

Goal:

- Recognize that an action is x402-capable.
- Reject any `402` unless the action has explicit x402 config.

Why:

- This creates a safe base state before any payment code exists.

### Phase 2: Parse and validate challenge

Goal:

- Parse the `402` response.
- Validate payee, amount, network, asset, facilitator, and path against policy.

Why:

- The Broker must know whether a challenge is even eligible to pay.

### Phase 3: Idempotency and receipts

Goal:

- Add persistent request fingerprinting, `payment-identifier`, and receipt storage.

Why:

- This is the minimum bar for avoiding double payment.

### Phase 4: Auto-pay for low-risk actions

Goal:

- Support very small capped payments automatically.

Why:

- This is the useful part of x402, but only after the safety rails exist.

### Phase 5: Approval path

Goal:

- Add a manual approval response for larger payments.

Why:

- Some actions should be allowed, but not silently.

## Threats this design should stop

- Prompt injection that tries to make the agent spend money repeatedly.
- A malicious upstream that returns a fake or inflated `402` challenge.
- Replay of a valid payment against a different request.
- Double payment caused by retries after timeout or crash.
- Using x402 as a side channel to leak wallet or receipt secrets.
- Using a paid endpoint as a generic open proxy.

## Out of scope for first version

- Multi-wallet routing
- Cross-chain smart payment selection
- Dynamic price negotiation
- Agent-chosen payment assets
- Exposing receipt internals to the model

## Simple summary

Today this repo protects secrets.

To support x402 safely, it also needs to protect money.

The right way to do that is:

- make payment explicit in action config
- verify every challenge against policy
- bind payment to one exact request
- store idempotency data durably
- cap spend aggressively
- require approval when cost is not tiny
- keep all payment logic and secrets inside the Broker
