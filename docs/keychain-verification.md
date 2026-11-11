# Obsidian keychain integration — Issue #1

Originally implemented as an unreleased source commit. Now included in releases 0.3.13 and 0.3.14; final integrated acceptance is recorded in [release verification](release-verification.md). The 74-test record below describes the earlier isolated Keychain commit, not the final 90-test release.

## Behavior

- Native SecretComponent lets users create or select an Obsidian keychain entry. The settings page includes a three-step setup guide.
- Plugin configuration stores the secret name, not the API key. Requests resolve the current keychain value.
- Existing plaintext and legacy encrypted keys are written to the keychain and read back before configuration is replaced. Migration errors preserve the original configuration.
- Generated IDs obey Obsidian's 64-character limit. Existing shared entries with different values are not overwritten.
- Unlinking preserves shared secrets. Missing or empty referenced keys fail with an actionable error.
- Old source files and backups are not deleted. This change does not promise OS-level encryption or cross-device secret synchronization.

## Validation — 2026-11-11

The exact staged source, excluding unrelated local work, was exported to an independent directory. A clean `npm ci --ignore-scripts`, lint, TypeScript check, all 74 tests, build, package validation, and dependency-tree check passed. Dependency installation reported zero vulnerabilities.

Actual UI acceptance used Windows and Obsidian 1.15.0 in an isolated vault on the local integration build:

- Migrated a synthetic plaintext key and verified that the stored configuration contains no API key.
- Created and selected a key through the native dialog, then used Save and test and model discovery.
- Translated a fixture plugin through a local authenticated endpoint; verified translated controls, button behavior, and unchanged input values.
- Verified key rotation, plugin reload, offline dictionaries, unlink persistence, and missing-key feedback.
- Ran one real DeepSeek connection test through a keychain reference. Only a synthetic connection sentence was sent. Temporary real credentials were cleared afterward; the original configuration hash remained unchanged.
- Visually inspected the setup guide in the actual Obsidian window and checked for horizontal overflow.

The UI run discovered and fixed an overlong generated secret ID; the regression fixture now enforces the actual host limit. Other providers' live APIs and other desktop operating systems were not tested.
