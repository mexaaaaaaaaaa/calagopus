# Security Summary

This walkthrough documents the security, reliability, and Calagopus packaging fixes applied to the Petalnodes theme (`io.calagopus.blush`).

## Issues Found & Fixed

1. **Silently Swallowed Async Failures & False Success Toasts**
   - **Risk:** Across server management and account pages, mutation handlers invoked async callbacks without `await` and immediately displayed success notifications or closed dialogs even when live API calls failed. In `src/App.tsx`, `notifyLiveDispatchError` caught request errors without rethrowing them, masking failed operations from the UI.
   - **Fix:** Updated callback signatures across `ServerSchedulesPage.tsx`, `ServerNetworkPage.tsx`, `ServerStartupPage.tsx`, `ServerUsersPage.tsx`, `ServerSettingsPage.tsx`, `AccountProfilePage.tsx`, `AccountSecurityPage.tsx`, `AccountSshKeysPage.tsx`, and `AccountApiKeysPage.tsx` (as well as the previously updated server pages) so every mutation awaits `Promise.resolve(...)` inside `try/catch` before reporting success. Updated `notifyLiveDispatchError` in `src/App.tsx` to rethrow errors cleanly.

2. **Predictable Token Fallback When Web Crypto Is Unavailable**
   - **Risk:** `cryptoRandomToken` in `src/App.tsx` previously fell back to `Date.now().toString(36)` + `Math.random()` if `globalThis.crypto?.getRandomValues` was absent, producing predictable token strings in constrained runtimes.
   - **Fix:** Removed the non-cryptographic fallback in `src/App.tsx` so `cryptoRandomToken` fails closed by throwing an error when a cryptographically secure random number generator is unavailable.

3. **UTF-8 / Emoji Crash During SSH Key Fingerprint Encoding**
   - **Risk:** Adding an SSH public key whose comment contained non-ASCII characters (such as `🌸@workstation`) threw `InvalidCharacterError` in `btoa(...)` inside `src/App.tsx`.
   - **Fix:** Added `encodeUtf8ToBase64` in `backend-extensions/io_calagopus_blush/frontend/src/api/calagopusCore.ts` using `TextEncoder` + byte encoding, and wired `handleAddSshKey` in `src/App.tsx` to use it safely.

4. **Unsafe File Downloads, Image Sources, & Invalid Network Inputs**
   - **Risk:** File/backup downloads and external links lacked centralized filename/URL guards, and `validateConnectionsFrom` / `isValidCidr` needed strict boundary checks to prevent malformed hosts, whitespace, or control characters from reaching API payloads.
   - **Fix:** Added `triggerSafeBrowserDownload` in `src/App.tsx` guarded by `sanitizeHref` and `sanitizeDownloadFilename`; constrained `sanitizeImageSrc` in `calagopusCore.ts` to safe HTTP(S) URLs and validated raster image data URIs (excluding SVG scripts); tightened IPv4/IPv6 CIDR bounds in `isValidCidr` and database host rules in `validateConnectionsFrom` / `validateDatabaseCreate` (`calagopusModules.ts`). Binary file previews now trigger an informational notice rather than creating dummy text files.

5. **Dynamic `prefers-reduced-motion` Reactivity**
   - **Risk:** `PetalIslandScene.tsx` previously evaluated `prefers-reduced-motion: reduce` only once at initial mount, leaving the 3D WebGL scene running if a user enabled reduced motion mid-session.
   - **Fix:** Subscribed `PetalIslandScene.tsx` to `window.matchMedia('(prefers-reduced-motion: reduce)')` change events and disabled 3D orbit animation buttons when `IslandStaticFallback` is active in `PetalIslandShowcaseCard.tsx`.

6. **Calagopus Extension Packaging Hygiene & Metadata Alignment**
   - **Risk:** `Metadata.toml` used an `[extension]` TOML header incompatible with Calagopus's top-level `MetadataToml` parser; `backend/Cargo.toml` and `lib.rs` needed workspace alignment and `ExtensionStruct`; and packaging raw source files without exclusions risked shipping `shared-adapter.ts`, `frontend/tsconfig.json`, `*.test.ts`, or local config files inside the `.zip.c7s` bundle.
   - **Fix:** Aligned `Metadata.toml`, `backend/Cargo.toml`, `backend/src/lib.rs`, `frontend/package.json`, and `frontend/src/index.tsx` with `calagopus/panel`'s extension loader. Added `scripts/build-c7s-package.mjs` and `scripts/validate-c7s-package.mjs` to deterministically produce `Petalnodes-Theme.zip.c7s` with explicit ZIP directory entries and strict exclusions.

---

## PoC Verification

### Executed Locally (Verified Passing After Final Edits)

- **Unit Tests (`npx --yes tsx --test backend-extensions/io_calagopus_blush/frontend/src/*/*.test.ts`):** Verify URL/image/UTF-8 helpers, CIDR validation, SSH/database/cron input validation, dashboard sorting/filtering, route mapping, and 3D layout/texture builders (`node:test`).
- **TypeScript Strict Checks (`npx tsc --noEmit` & `npx tsc --noEmit -p backend-extensions/io_calagopus_blush/frontend/tsconfig.json`):** Zero errors across standalone preview shell and extension package.
- **Production Bundle (`npm run build`):** Clean Vite production bundle with zero unresolved imports or assets.
- **Package Generation & Integrity (`npm run package:c7s && npm run verify:c7s`):** Builds `Petalnodes-Theme.zip.c7s`, verifies `unzip -tqq` integrity, explicit directory entries (`backend/`, `backend/src/`, `frontend/`, `frontend/src/`), `Metadata.toml`, `Cargo.toml`, `lib.rs`, `frontend/package.json`, and exclusion of `shared-adapter.ts`, `tsconfig.json`, `*.test.ts`, and `.env*`.
- **Headless Browser Verification (`playwright-cli`, Chromium at `http://localhost:3000`):**
  - **Desktop (`1440x900`):** Verified zero console errors/warnings, Petalnodes baby-pink layout, ambient petals, interactive 3D `PetalIslandScene`, `DoodleCrewFooter`, negative & positive validation on Databases (`"not a valid host"` rejected; `"s42_rewards"` created), binary file download guard, SSH key creation with UTF-8 emoji comment `"🌸@workstation"`, API key reveal, and Admin telemetry view.
  - **Mobile (`390x844`):** Verified responsive drawer navigation and `scrollWidth === innerWidth === 390` (zero horizontal overflow).
  - **Reduced Motion (`reducedMotion: "reduce"`):** Verified `PetalIslandScene` dynamically switches to the hand-inked SVG `IslandStaticFallback` with zero WebGL errors.

### Not Executed in This Container (Requires Live VPS / Toolchain)

- **Rust Extension Compilation (`cargo check` / `cargo clippy` / `cargo build`):** No Rust toolchain or Calagopus Panel workspace is mounted inside this sandbox container; Rust syntax was inspected statically against `shared::extensions::Extension`.
- **Live Calagopus Panel Apply & VPS Service Verification:** No SSH credentials, live VPS filesystem, or live Calagopus Panel API endpoint are accessible from this container. Live `panel-rs extensions add` / `apply`, systemd/container logs, and remote `git push` must be executed directly from an authorized operator shell on your VPS/repository.
