# Tauri Updater Setup

Chaos Core now uses Tauri's built-in updater in production desktop builds.

## What Is Already Wired In

- Signed updater artifacts are enabled in `src-tauri/tauri.conf.json`.
- The app checks GitHub Releases at `https://github.com/wayrou/chaos-core/releases/latest/download/latest.json`.
- Production builds check for updates on startup at most once every 6 hours and wait until the main menu before prompting.
- GitHub Actions release automation lives in `.github/workflows/release.yml`.

## One-Time GitHub Secret Setup

The local signing key currently lives at `~/.tauri/chaos-core-updater.key`.
The previous encrypted key was backed up locally because it could not be used without its missing password.

Add these repository secrets in GitHub:

1. `TAURI_SIGNING_PRIVATE_KEY`
   Paste the full contents of `~/.tauri/chaos-core-updater.key`.
2. `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   Omit this secret for the current key, which uses an intentionally empty password. Only add it if you rotate to a non-empty password later.

## Releasing A New Auto-Update Build

1. Bump the version in `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`.
2. Push a tag like `v0.1.1`, or run the `publish` workflow manually.
3. GitHub Actions will build the signed artifacts and publish `latest.json` to the newest release.

## Notes

- Tauri updater signing is separate from platform code signing. macOS notarization and Windows signing are still worth adding later for smoother OS trust prompts.
- If the private key is lost, existing installs can no longer receive updater-signed releases.
