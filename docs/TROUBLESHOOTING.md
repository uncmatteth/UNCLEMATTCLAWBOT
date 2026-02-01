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
