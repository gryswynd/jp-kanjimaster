# Post-mortem — QA reset poisoned a real account's progress (2026-07-06)

**Impact:** Joel's production account (`users/PhyG8CnR…`) carried 27 fabricated
completions (N4.25–36, G25–31, N4.Review.12–18, N4.Final.Review) for several
weeks. Surfaced as "all lessons complete" on his Pixel after a debug reinstall
pulled server state. No student accounts affected. Fully repaired same day.

---

## Timeline

- **~mid-June 2026** — `?reset=all-content` (the QA shortcut that marks every
  N5+N4 item complete at score 60) runs in a browser signed in to the real
  account. The next sync PUT merges the fabricated completions into
  `users/{uid}`. Nothing notices: the account already had most N5/N4 done, so
  the home screen barely changed on the device being used.
- Real study continues on top (N4.22 at 92, N4.23 at 94, N4.24 at 72 — genuine
  scores prove the poisoning predates them).
- **2026-07-06** — a debug APK install cold-boots the Pixel; the boot pull
  merges the poisoned server doc down; home shows everything complete/unlocked.
  Investigation → repair.

## Root cause (five whys)

1. **Why did the account show fake completions?** The server doc contained
   them, and every device pull re-imported them.
2. **Why did the server have them?** A sync PUT uploaded them; the server
   merge is monotonic (completions merge via OR, scores via max — see
   `server/lib/merge-progress.js`), so once up, they could never be removed by
   any later honest sync.
3. **Why were they uploaded?** `?reset=all-content` fabricates completions
   into the *same* localStorage keys real progress uses (`k-lesson-completed`,
   `k-lesson-scores`), and the sync layer treats every write to those keys as
   real progress to push.
4. **Why did it run against a real account?** The QA reset shortcuts had no
   awareness of auth state — nothing distinguished a throwaway QA browser from
   a signed-in production session.
5. **Why wasn't it caught for weeks?** No detection (nothing flags an
   implausible bulk state) and no recovery path (no doc history), so the only
   trigger for discovery was a fresh device pulling the full server state.

**Design tension at the core:** merge-max exists so a blank device can never
wipe an account — the right call for students. Its price is that *additive*
garbage is permanent. The fix is therefore to keep merge-max and make garbage
unable to reach it, plus give the server an undo.

## Detection & repair (how it was fixed)

- **Fingerprint:** fabricated entries all score exactly 60 (`all-content` only
  raises scores below 60); real entries carry varied scores. 27/27 of the
  suspect items scored exactly 60 on both device and server.
- **True frontier:** computed as the manifest prerequisite-closure of the last
  genuinely-played lesson (N4.24, score 72). Everything outside the closure +
  N4.24 itself = 114 real completions; the 27-item complement was dropped.
- **Repair order matters:** BOTH sides must be cleaned before they next sync,
  or merge-max re-infects. (1) Trim device localStorage via adb-forwarded CDP;
  (2) immediately overwrite the Firestore doc with a full `set()` (bypasses
  merge on purpose) using gcloud ADC from `server/`; (3) re-verify both.
- SRS items had also been seeded off fake completions → wiped both sides to
  re-seed from the corrected set (approved trade-off: review-ladder levels
  reset).

## Guards shipped (defense in depth)

1. **Auth mirror** — `app/shared/auth.js` mirrors "real account signed in"
   into `k-auth-real`. The reset block runs before Firebase exists; this
   marker is the only auth signal it can consult.
2. **Guard A (UX wall)** — the three fabricating reset scopes (`grammar`,
   `n52`, `all-content`) refuse to run while `k-auth-real` is set, with an
   alert explaining why. Delete-only scopes stay unguarded (deletions never
   propagate; pull restores them).
3. **Guard B (hard wall)** — fabricating scopes stamp `k-qa-fabricated`
   before writing anything. `app/shared/sync.js` refuses `push()`/
   `schedulePush()` while the marker is set (console warn + one-time "cloud
   sync is OFF" toast). Pull stays allowed. The marker clears only via
   `?reset=all`. This holds even in the fabricate-first-sign-in-later order,
   and even if Guard A is raced (e.g. `?reset=all` momentarily clears the
   mirror).
4. **Guard C (recovery net)** — `server/lib/firestore.js` `saveProgress`
   snapshots the previous doc to `users/{uid}/history/{ts}` inside the write
   transaction (pruned to the newest 20). Any future bad merge is one
   restore away. Mirrored in the memory store; covered by
   `server/test/progress-history.test.mjs`. **Requires a server deploy.**

## Lessons

- Monotonic merge + fabricated test data in shared keys = permanent poisoning.
  Any future QA/state-fabrication tool must either stamp `k-qa-fabricated` or
  use entirely separate storage.
- Never QA signed in to a real account — see `docs/device-testing.md`.
- A cold boot after `pm install` renders home as if progress were wiped for a
  few seconds (manifest + sync not loaded). Don't panic; don't "fix" it.
- Keep a server-side undo for every irreversible merge structure.
