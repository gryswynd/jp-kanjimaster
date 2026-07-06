# Device testing & QA protocol

Rules and recipes for testing on real phones (and QA'ing the web build)
without endangering production data. Written after the 2026-07-06
progress-poisoning incident — read
`docs/postmortem-2026-07-06-progress-poisoning.md` for why each rule exists.

---

## The golden rule

**Never run QA with a real account signed in.** Progress sync is monotonic
(merge-max): fabricated completions that reach the server are permanent for
that account. Enforced in code, but treat the guards as backstops, not
permission:

- The fabricating reset scopes (`?reset=all-content`, `?reset=n52`,
  `?reset=grammar`) refuse to run while a real account is signed in
  (`k-auth-real` mirror).
- Any device/browser that HAS run a fabricating reset carries
  `k-qa-fabricated` and will **never push** to the server until a full
  `?reset=all`. Do not remove or bypass this guard — not even to make a test
  pass.

**Test identity policy:** QA under the app's silent anonymous identity
(default when signed out). Use a dedicated throwaway test account ONLY when
sign-in/sync flows are themselves under test — never `gryswynd@gmail.com`.

## Installing to a device

- Android debug install: `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`.
  `install -r` / `pm install` preserve app data but **kill the running app**.
- **Cold-boot illusion:** for a few seconds after a forced restart, home
  renders as if progress were wiped (manifest + sync not yet loaded). Wait —
  don't panic, don't start "repairing".
- Don't auto-relaunch the app after installing while someone is holding the
  phone; let them open it.
- Large APK over a flaky cable: switch to Wi-Fi adb
  (`adb tcpip 5555` while USB is briefly alive → `adb connect <phone-ip>:5555`),
  then `adb push` + `adb shell pm install -r /data/local/tmp/…`.

## Keeping the phone awake (courteously)

- `adb shell svc power stayon true` keeps the screen on while charging —
  great during a debug session. **Always restore** with
  `svc power stayon false` when done (and `input keyevent KEYCODE_SLEEP` to
  hand back the lock screen).

## Live-debugging the WebView (debug builds)

```sh
PID=$(adb shell pidof com.rikizo.app)
adb forward tcp:9223 localabstract:webview_devtools_remote_$PID
# then Playwright: chromium.connectOverCDP('http://localhost:9223')
```

- The app must be foreground; the pid (and thus the socket name) changes on
  every launch — re-forward after any restart.
- `page.evaluate` gives full read/write access to the live app, including
  localStorage. **Read-only probes freely; state-mutating writes only with
  explicit approval** — you are operating on someone's real data.
- Console output also lands in `adb logcat` (Capacitor/Console tag).

## QA reset reference (`?reset=…` on the web build)

| Scope | Effect | Poisoning risk |
|---|---|---|
| `all` / `1` | wipe every `k-*` key (also clears `k-qa-fabricated`) | none — deletions never sync |
| `onboarding` / `tutorial` / `progress` / `gamify` / `reading-aids` | delete specific keys | none |
| `grammar` / `n52` / `all-content` | **fabricate** completions | blocked signed-in; stamps `k-qa-fabricated` (sync off) |

## Recovery (if production data is ever damaged again)

1. Every server save keeps the previous revision at `users/{uid}/history/{ts}`
   (newest ~20). Inspect + restore with `@google-cloud/firestore` + gcloud ADC,
   running the script from `server/` so deps resolve.
2. Restoring = full-doc `set()` of the chosen revision (bypasses merge — this
   is intentional and is the ONLY way to remove merged-in data).
3. Clean BOTH sides (server doc + every device's localStorage) before any of
   them syncs again, or merge-max re-infects.
4. Fabrication fingerprint: QA-fabricated scores are exactly 60; real scores
   vary. True frontier = manifest prerequisite-closure of the last genuinely
   played item.
