# Release Checklist

## Must-pass checks
- [ ] No secrets in repo (run secret scan; verify `.gitignore` coverage)
- [ ] Broker binds loopback only by default
- [ ] Broker requires mTLS
- [ ] Broker does not accept arbitrary URLs/headers/redirects
- [ ] OpenClaw runs without third-party keys in env/config
- [ ] OpenClaw sandbox has no egress by default
- [ ] Tool policy deny-by-default; only `uncle_matt_action` allowed when opted-in
- [ ] Integration tests pass
- [ ] Prompt injection suite reviewed
- [ ] Docker image build passes (`scripts/build-broker-image.sh`)
- [ ] Release bundle created (`scripts/package-release.sh`)

## Operational guidance present
- [ ] How to rotate secrets
- [ ] How to add new actions safely
- [ ] What to do if compromise suspected
- [ ] Remote access guidance (SSH tunnel recommended)
- [ ] Manual install guide included (until installer is complete)
