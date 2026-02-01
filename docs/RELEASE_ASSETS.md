# Release Assets

This project provides prebuilt artifacts to minimize operator error.

## Broker Docker image
Use the build script to create a tagged image:

- `scripts/build-broker-image.sh`
- Optional: `scripts/build-broker-image.sh --save --out _artifacts/images`

## Release bundle
Creates a tarball with broker, extension, skill, installer, docs, and tests:

- `scripts/package-release.sh`

Output: `_artifacts/release/uncle-matt-<version>.tgz`

## Notes
- The release bundle excludes node_modules and dist artifacts.
- `_artifacts/` is gitignored.
