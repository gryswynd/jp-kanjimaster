# Rikizo — Architecture (plain-English)

This is the map of how the whole product fits together: what runs where, what
talks to what, and what we still need to build. Written to be readable without a
backend background. Update it as decisions change.

---

## The big picture: two pillars, one spine

We are building **one product made of two apps** that share a curriculum, a cast
of characters, an art pipeline, and (soon) a user's progress.

- **Pillar 1 — The learning app** (this repo, `jp-kanjimaster`).
  Capacitor app, **iOS now, Android next**. Lessons, grammar, stories, reviews,
  compose, the SRS-style unlock chain. Built with plain HTML/JS/CSS running in a
  web view. This is also the **content authoring hub**.

- **Pillar 2 — The game** (`../jp-lessons`, "Rikizo House Adventure").
  A **Godot 4.6** narrative adventure. An explorable world, gated by lesson
  progress (finish lesson `N5.2` → unlock in-game Day 2).

- **The spine — a shared cloud backend** (partly exists, mostly to build).
  Accounts, saved progress, the AI tutor, and subscriptions. This is what turns
  "two separate apps" into "one product that remembers you everywhere."

```
        ┌──────────────────────────┐        ┌──────────────────────────┐
        │  LEARNING APP (Capacitor)│        │   GAME (Godot)           │
        │  iOS / Android           │        │   iOS / Android          │
        │  lessons · grammar ·     │        │  explorable world,       │
        │  stories · reviews · SRS │        │  gated by lesson progress│
        └─────────────┬────────────┘        └────────────┬─────────────┘
                      │  internet (login, sync, AI, receipts)
                      ▼                                   ▼
        ┌────────────────────────────────────────────────────────────┐
        │                     CLOUD (the spine)                        │
        │  • Firebase Auth   → accounts / login                        │
        │  • Firestore       → saved progress (shared by both apps)    │
        │  • Cloud Run server→ AI tutor + payment-receipt checks       │
        └────────────────────────────────────────────────────────────┘
                      ▲                                   ▲
                      │            payments               │
              ┌───────┴────────┐                  (content is bundled
              │ Apple / Google │                   inside each app, or
              │  in-app purchase│                  fetched from a CDN)
              └────────────────┘
```

---

## What runs ON the device vs IN the cloud

**On the device (works offline):**
- All the UI and screens.
- The lessons/grammar/stories content (shipped *inside* the app as JSON; see
  Content below).
- Reading aids (furigana/romaji), local text-to-speech, the themed module scenes.
- The Godot game world and its day-by-day content.

**In the cloud (needs internet):** only the four things that genuinely can't live
on one phone —

1. **Accounts** — so your data is yours and survives reinstalls / new devices.
2. **Progress** — one source of truth both apps read & write.
3. **The AI tutor** — the Claude API key must stay on a server, never in the app.
4. **Payments** — recording who has paid (the money itself is handled by
   Apple/Google; see Payments below).

Everything else stays on-device and offline-first.

---

## What exists today vs what's missing

**Exists:**
- A deployed **Google Cloud Run** server (`server/`) for the **AI tutor**
  (Press-to-Ask): device identity, per-tier daily quotas, cost metering, a
  store-facade that uses **Firestore** in production and in-memory locally.
- A **shared content layer**: the game reads the *same* JSON the learning app
  does — `glossary.*.json`, `characters.json`, `conjugation_rules.json`,
  `counter_rules.json`, `particles.json` — and the *same* lesson IDs (`N5.1`…)
  and characters (Rikizo, Yamakawa, …).
- A shared **art pipeline**: illustrated art (game sprites/portraits *and* the
  learning-app scene art) is generated through the Gemini/"PaperBanana" pipeline
  in the game repo. The learning app's `assets/scenes/ART_PROMPTS.md` feeds the
  same pipeline.

**Missing (the gap to a "real" product):**
- **Accounts / login** — identity today is an anonymous per-install `device-id`.
- **Progress sync** — the learning app saves to `localStorage`, the game saves to
  a local `user://save_data.json`; neither survives reinstall or crosses devices,
  and the two pillars can't see each other.
- **Account-level subscription** — a tier model exists per *device* (free / lite /
  mid / premium) but not per *account*.
- **Game networking + iOS/Android export config** for Godot.

---

## The recommended backend

**Stay on Firebase / Google Cloud** — we already run Firestore + Cloud Run there,
so we extend rather than rebuild. (Supabase is the main alternative — same idea,
but a SQL/Postgres database instead of Firestore's document store. Not worth
switching given what's already deployed.)

Pieces:
- **Firebase Auth** → logins. Start **anonymous** (today's device-id maps to an
  anonymous account so people can play immediately), then **link** to Sign in with
  Apple / Google / email without losing progress. (Apple sign-in is needed for the
  App Store anyway.)
- **Firestore** → the saved-progress database, one document tree per user:
  - `users/{uid}/profile` — name, email, settings.
  - `users/{uid}/learning` — lesson scores, completions, flagged terms, review
    scores, streak, compose drafts (today's `k-*` localStorage values).
  - `users/{uid}/game` — the Godot save blob (current day, trackers, inventory,
    yen, narrative flags).
- **Cloud Run server** (already exists) → keeps doing the **AI tutor**, and gains
  **payment-receipt verification** + verifying login tokens.
- **Sync rule** — offline-first; each field carries an `updatedAt`; on conflict,
  **last write wins**. Deliberately simple (one user, ~2 devices — no need for
  anything fancier).

**Cross-pillar gating falls out for free:** the learning app marks `N5.2`
complete in `users/{uid}/learning`; the game reads the same field → Day 2 unlocks.
No special bridge.

---

## Payments (the part that surprises everyone)

For a downloaded app selling a **digital subscription**, Apple and Google
**require** their own in-app purchase systems (StoreKit / Play Billing) and take a
cut (~15–30%). You can't substitute Stripe for in-app digital goods.

Flow:
1. User taps **Subscribe** → **Apple/Google** handle the card + the money.
2. The app receives a **receipt**.
3. Our **Cloud Run server verifies** the receipt with Apple/Google.
4. The server flips the account to **premium** in Firestore.
5. Both pillars read "this user is premium."

So our payment code is mostly *"verify receipt, set a flag"* — not processing
credit cards. (Stripe/web checkout is for things sold *outside* the app — e.g. a
website, or real-world services like live lessons — possible later, not the
in-app path.)

Both Firebase and Cloud Run have free tiers that cover early usage; the main
variable cost is AI calls, which the server already meters and caps.

---

## Content & art pipeline (already shared)

- **Curriculum content** is authored in this repo (the lesson/story/glossary JSON,
  governed by `CLAUDE.md`), shipped *inside* each app. The game consumes the same
  files — "zero content migration."
- **Lesson IDs** (`N5.1`, `N5.2`, …) are the shared key both pillars and the
  backend speak.
- **Illustrated art** (game + learning-app scenes) comes from one Gemini-based
  generation pipeline; prompts live in `assets/scenes/ART_PROMPTS.md` (web scenes)
  and the game repo's art pipeline doc.

---

## Roadmap / sequencing

1. **Backend foundation (do first).** Firebase Auth (anonymous → linked) + the
   `users/{uid}` progress schema + a sync module that replaces direct
   `localStorage` writes on the web side + token verification added to the
   existing Cloud Run server.
2. **Game sync + gating.** Add an HTTP client in Godot; read/write the same
   progress doc; unlock days from `learning.lessonCompleted`.
3. **Polish (in parallel, small spikes).** A sound + haptics pass; a Rive-animated
   Rikizo for story comprehension; a WebGL "book-curl" page turn + living module
   environments.
4. **Game store presence.** Configure Godot iOS/Android export when content depth
   warrants it.
5. **Subscriptions.** Wire StoreKit / Play Billing + receipt verification; move the
   tier from device to account.

---

## Mini-glossary

- **Backend / server** — a program running on an always-on computer in a data
  center that every copy of the app talks to over the internet.
- **The cloud** — those rented data-center computers (here: Google Cloud).
- **BaaS (Backend-as-a-Service)** — a service that hands you ready-made accounts +
  database + storage so you don't build that plumbing yourself. *Firebase* and
  *Supabase* are the two big ones.
- **Firebase** — Google's BaaS. We use **Firestore** (its document/"NoSQL"
  database) and will add **Auth** (logins).
- **Supabase** — open-source BaaS built on **Postgres** (a SQL database). The main
  alternative to Firebase; not chosen here.
- **Cloud Run** — Google service that runs our custom server code (the AI tutor).
- **Firestore** — Firebase's database; stores flexible JSON-like "documents."
- **Auth** — the login/identity system.
- **IAP (in-app purchase)** — Apple/Google's required payment system for digital
  goods inside an app.
- **device-id** — today's anonymous per-install identifier; will map to a real
  account once Auth exists.
- **offline-first** — the app works without internet and syncs when it reconnects.
