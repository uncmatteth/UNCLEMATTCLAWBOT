# Troubleshooting

## Integration tests fail: "openclaw CLI not found"
- Install OpenClaw and ensure `openclaw` is on PATH.

## Docker compose errors
- If `docker compose` is missing, install the Docker Compose plugin.
- If `docker-compose` fails with distutils errors, install a newer Python or use the plugin.

## Broker fails to start due to schema file
- Ensure `actions.schema.json` is mounted next to `actions.json`, or set `BROKER_ACTIONS_SCHEMA_PATH`.

## mTLS errors
- Verify cert paths and that the client cert is signed by the broker CA.
- Confirm the Broker is listening on 127.0.0.1 and the cert SAN includes localhost/127.0.0.1.

## Audit fails
- Run `openclaw security audit --fix` and then re-run `--deep`.
- Ensure tool allow/deny and sandbox settings match the safe defaults.

## Suspected compromise

1. Stop the broker and disable the Uncle Matt plugin. Do not keep retrying the
   suspicious action.
2. Revoke or rotate every broker-side credential that may have been exposed.
   Treat a credential found in Git history, logs, chat, config, or a release
   archive as compromised even if the file was later deleted.
3. Preserve redacted logs, timestamps, action IDs, and hashes for review. Never
   preserve or paste the secret value itself.
4. Run the full-history Gitleaks scan, broker tests, isolated OpenClaw audit,
   tool-policy check, sandbox inspection, and release-archive scan before
   restoring service.
5. Re-enable only the minimum read-only actions required. Write, payment,
   purchase, mint, publish, and spend actions stay disabled until separately
   reviewed and authorized.

## Remote access

- Keep the OpenClaw gateway and broker bound to loopback.
- Reach them through an authenticated SSH tunnel from a trusted device; do not
  expose either listener directly to the LAN or internet.
- Keep mTLS enabled even inside the tunnel. A tunnel does not replace broker
  client-certificate authentication.
