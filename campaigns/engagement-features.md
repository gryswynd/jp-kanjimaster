# Engagement Features Campaign — Daily Reminders, Streaks & Widget

> **Status:** Active — Phase 2 (Email Reminders) built, awaiting deployment
> **Started:** 2026-03-24
> **Last updated:** 2026-03-25
> **Decision:** Email reminders via Resend + Cloudflare Worker. Self-service opt-in. Client will set up Cloudflare + Resend accounts, then deploy.

---

## What Clients Are Asking For

Clients switching from Duolingo miss three engagement features:

1. **Daily push reminders** — phone notification even when the app isn't open
2. **Streak tracking** — consecutive day counter with visual progression
3. **Home screen widget** — Rikizo's face + streak count visible on the phone's home screen without opening the app

---

## Strategic Direction: Wrapper Now, Full Rebuild Later

The learning app is a web app embedded in Webflow. The Godot migration is for the game portion only. The long-term goal is to be a real contender against Duolingo and similar apps.

**Why wrapper now, not a full native rebuild:**

1. **Content library is still growing.** N4 isn't complete, N3 is in planning, 17 game days to build. The web stack + 4-agent content pipeline lets us iterate on content fast. A full rebuild would freeze content development for months.
2. **Product-market fit isn't proven yet.** We need users testing the differentiated product (Rikizo, Training Arc, story-driven learning) before locking into a native architecture.
3. **The Godot game isn't ready.** It's in Phase 1 planning. A full native app that houses the game needs the game to exist first.
4. **Clients want push notifications now**, not in 6+ months.
5. **A Capacitor wrapper is not throwaway work:**
   - Streak engine (JS) carries forward to any future stack
   - Push notification backend (serverless + FCM) is the same regardless of frontend
   - Widget extensions (Swift/Kotlin) are native code that stays native in any future app
   - App Store presence (listing, reviews, downloads) carries forward
   - Content pipeline doesn't change at all — JSON files are JSON files

**When to evaluate a full native rebuild:**
- WebView performance becomes a bottleneck (complex animations, offline, large datasets)
- Godot game is shipping and needs seamless transitions with the learning app
- Enough users/revenue to justify 6+ months of pure engineering
- Users request features that web tech can't deliver (AR, heavy offline, native gestures)

---

## Platform Capability Matrix

| Feature | Current Web App | PWA | Capacitor Wrapper (chosen) |
|---|---|---|---|
| **Streak tracking** | ✅ localStorage | ✅ | ✅ |
| **Push reminders** | ❌ | ⚠️ iOS limited | ✅ Full (FCM/APNs) |
| **Home screen widget** | ❌ | ❌ | ✅ Native extensions |
| **App Store presence** | ❌ | ❌ | ✅ |
| **Godot game embed** | ❌ | ❌ | ✅ Native module |
| **Content iteration speed** | ✅ Fast | ✅ Fast | ✅ Fast (web content unchanged) |

---

## Phased Roadmap

### Phase 1: Streak Engine (Web App — Build Now)

No infrastructure changes. Works on the current web app immediately. Carries forward into the Capacitor wrapper unchanged.

**New module:** `app/shared/streak.js`

**localStorage keys:**
- `k-streak-current` — consecutive day count
- `k-streak-best` — all-time best
- `k-streak-last-active` — ISO date of last qualifying activity
- `k-streak-history` — last 30 active dates (for calendar/widget display)
- `k-streak-freezes` — available streak freezes (earn 1 per 7-day streak, max 2)

**Qualifying activity:** Completing any lesson, review, practice session, compose submission, or story.

**"Rikizo's Training Arc" — streak stages:**

| Days | Stage | Belt |
|---|---|---|
| 1-2 | しょしんしゃ (Beginner's Path) | White |
| 3-6 | まいにち (Daily Discipline) | Yellow |
| 7-13 | いっしゅうかん (Week Warrior) | Green |
| 14-29 | にしゅうかん (Fortnight Force) | Blue |
| 30-59 | いっかげつ (Monthly Master) | Purple |
| 60-89 | きせつ (Season Sage) | Brown |
| 90+ | でんせつ (Living Legend) | Black |

**Streak freeze mechanic:** Earn 1 freeze per 7-day streak achieved (max 2 stockpiled). Auto-activates on a missed day, preserving the streak. Gentler than Duolingo — avoids anxiety of losing long streaks to one bad day.

**Menu display:** Streak count + stage name in Japanese + 7-day activity dots in the main menu header.

**Integration points (one `JPShared.streak.recordActivity()` call each):**

| Module | Location | Event |
|---|---|---|
| Lesson.js | Line ~541 | `unlock.computeUnlocks()` returns `passed=true` |
| Review.js | Line ~1198 | `progress.setReviewScore()` called in `renderEnd()` |
| Practice.js | Lines ~796, 1019, 1293, 1575, 1683, 1831 | `progress.setBestScore()` per game mode |
| Compose.js | Line ~1071 | Score overlay appended on "Score" click |
| Story.js | — | No completion tracking yet (needs new event) |

**Deliverables:**
- [ ] `app/shared/streak.js` — streak engine module
- [ ] `data/shared/rikizo-messages.json` — escalating drama message pool
- [ ] `webflow-embed.html` — add streak.js to load order, streak display in menu
- [ ] Feature module edits — add `recordActivity()` calls at completion points

---

### Phase 2: Email/SMS Daily Reminders (Lightweight — No App Store)

> **Pivot (2026-03-24):** Client wants to wait for game completion + more content before wrapping for iOS/Android. In the meantime, send reminders via email and/or text to keep students training.

Lightweight server-side reminder system using the existing web app. No Capacitor, no app stores, no native code.

**Architecture:**
- **Cloudflare Worker + KV** (free tier: 100k requests/day)
- Web app pings the Worker on each `streak.recordActivity()` call with student identifier + timestamp
- Daily cron trigger checks each student's last-active date
- If inactive today → send Rikizo reminder via email and/or SMS
- Message content from `data/shared/rikizo-messages.json` escalation tiers

**Sending channels:**

| Channel | Service | Cost | Setup |
|---|---|---|---|
| Email | Resend or SendGrid | Free ≤100/day | API key, verified sender domain |
| SMS/Text | Twilio | ~$0.008/text + $1/mo per number | Account + phone number |

**Student registration (two options — TBD based on class size):**
- **(A) Admin-configured list:** You add students manually (name, email/phone, preferred channel). Good for <20 students. Stored in KV.
- **(B) Self-service opt-in:** Small form in the web app where students enter their own contact info. Better for growing user base.

**Web app changes:**
- `streak.recordActivity()` gains a server ping (POST to Worker with student ID + date)
- Student identifier: simple unique ID or name (no auth system needed for small groups)
- Optional: settings page for students to manage their reminder preferences

**Client decisions (resolved):**
- [x] How many students? → Self-service opt-in (students sign up themselves)
- [x] Email, text, or let them choose? → Email only (stopgap until app notifications)
- [ ] Sender domain: company domain or rikizo-themed domain (e.g. rikizo.app)?

**Deliverables:**
- [x] Cloudflare Worker: student registry + last-active tracking + daily cron (`worker/`)
- [x] Email integration (Resend API) (`worker/src/email/`)
- [x] Web app: server ping on activity (`app/shared/streak.js` — `pingServer()`)
- [x] Student self-service opt-in form (`app/shared/reminder-settings.js`)
- [x] Menu integration: envelope icon with registration indicator (`webflow-embed.html`)
- [x] Rikizo message escalation tiers: 7 tiers from streakAlive → streakAbsurd (`rikizo-messages.json`)
- [ ] **Client:** Create Cloudflare account + deploy Worker
- [ ] **Client:** Create Resend account + verify sender domain
- [ ] **Client:** Set Worker secrets (RESEND_API_KEY, HMAC_SECRET, SENDER_EMAIL, CORS_ORIGIN)
- [ ] Replace placeholder WORKER_URL in `streak.js` and `reminder-settings.js` with deployed URL

---

### Phase 2b: Capacitor Wrapper + Push Notifications (Deferred)

> **Deferred until:** Game is complete and content library is more mature. All Phase 2 server-side work (Worker, KV, message logic) carries forward — push notifications just become an additional channel alongside email/SMS.

Original Capacitor plan preserved below for when the time comes.

Wrap the existing Webflow web app in a Capacitor native shell for App Store / Play Store distribution.

**What Capacitor provides:**
- Native WebView container loading the existing web app
- `@capacitor/push-notifications` plugin — FCM on Android, APNs on iOS
- JavaScript-to-native bridge for writing streak data to shared storage (for widget)
- `@capacitor/app` plugin — lifecycle events, deep linking
- `@capacitor/preferences` plugin — native shared storage (UserDefaults / SharedPreferences)

**Push notification backend (serverless):**
- Same Cloudflare Worker from Phase 2, extended with FCM token storage
- Daily cron adds push as a delivery channel alongside email/SMS

**App-side push flow:**
1. App registers for push on first launch → gets FCM token
2. Token + user identifier sent to serverless backend
3. On each app visit, `streak.recordActivity()` also pings the backend with "last seen" update
4. If user hasn't opened the app today, cron sends a push with escalating Rikizo drama

**Deliverables:**
- [ ] Capacitor project scaffolding (`capacitor/` directory)
- [ ] iOS Xcode project configuration (provisioning, signing)
- [ ] Android Gradle project configuration (keystore)
- [ ] Push notification plugin integration
- [ ] FCM token registration + storage in existing Worker
- [ ] JavaScript bridge: streak data → native shared storage
- [ ] App Store / Play Store developer accounts
- [ ] App Store / Play Store initial submission

---

### Phase 3: Home Screen Widget

Native widget extensions that display Rikizo's mood + streak data on the phone's home screen.

**iOS (WidgetKit — Swift):**
- Widget Extension target added to the Capacitor-generated Xcode project
- Reads streak data from shared App Group UserDefaults (written by the JS bridge in Phase 2)
- Small widget: Rikizo face expression + streak count + belt badge
- Medium widget: adds 7-day activity calendar + stage name in Japanese
- Tap anywhere opens the app

**Android (App Widgets — Kotlin):**
- AppWidgetProvider added to the Capacitor-generated Gradle project
- Reads from SharedPreferences (same bridge pattern)
- Same display layout as iOS

**Rikizo mood engine:**
- Mood calculated from days since last activity + current streak length
- Delighted (active today, streak 7+) → Happy (active today) → Neutral (1 day) → Concerned (2 days) → Sad (3-5 days) → Desperate (6+ days)
- Widget refreshes every 15-30 minutes (platform minimum). Sufficient since mood changes daily.

**Deliverables:**
- [ ] iOS WidgetKit extension (Swift)
- [ ] Android AppWidgetProvider (Kotlin)
- [ ] Rikizo mood engine (`app/shared/mood.js`)
- [ ] New Rikizo expression assets (see Art Assets section)

---

### Phase 4: Godot Game Integration

When the Godot game (from `campaigns/godot-migration.md`) reaches a shippable state, embed it into the Capacitor app as a native module.

**How this works:**
- Godot exports to iOS framework / Android AAR
- Capacitor plugin wraps the Godot view and manages transitions
- User taps "Rikizo's Adventures" in the web menu → bridge launches the Godot game view
- Game reads the same JSON content files
- Game writes progress to the same shared storage (streak, scores, unlocks)

**This phase is blocked on:** Godot migration campaign reaching Phase 4-5.

**Deliverables:**
- [ ] Capacitor plugin for Godot view embedding
- [ ] Shared storage bridge (Godot GDScript ↔ native UserDefaults/SharedPreferences)
- [ ] Transition animations between web learning app and Godot game
- [ ] Unified progress system across both engines

---

### Phase 5: Evaluate Full Native Rebuild (Future)

**Trigger conditions (need most/all of these):**
- WebView performance is a user-visible bottleneck
- Content library is mature (N5 complete, N4 complete, N3 in progress)
- Godot game is shipping and transitions feel janky in the hybrid setup
- User base is large enough to justify the investment
- Revenue model is established (subscriptions, IAP)

**Options at that point:**
- **Full Godot for everything** — learning app + game in one engine. Maximum coherence, biggest port effort.
- **React Native / Flutter** — modern cross-platform with native feel. Game still embeds as a module.
- **Stay hybrid** — if the Capacitor wrapper is performing well, maybe a full rebuild is never needed.

**This is a decision to make later, not now.** The Capacitor wrapper is the right architecture for the current stage of the product.

---

## Rikizo Reminder Messages — Escalating Drama

Messages escalate the longer the user is away, anime-style. Comedically dramatic, never mean. Think anime reaction faces, not guilt trips.

| Days Away | Rikizo Mood | Example Messages |
|---|---|---|
| 1 day | Calm | "Your streak is at 5 days! Come back and keep it going" |
| | | "Rikizo left you a note: 'See you tomorrow, right? ...RIGHT?'" |
| | | "Day 5! You're on the path of まいにち now." |
| 2 days | Worried | "Rikizo is pacing back and forth... your streak is in danger!" |
| | | "Rikizo checked the door 47 times today. Just saying." |
| | | "Your streak is wobbling like a jenga tower..." |
| 3 days | Shocked | "RIKIZO GASPS. Your beautiful streak! There's still time!" |
| | | "Rikizo dropped his おにぎり in shock. Three whole days?!" |
| | | "*Record scratch* You haven't studied in 3 days." |
| 5+ days | Dramatic | "Rikizo stares out the window... 'They haven't come back...'" |
| | | "Rikizo has been wearing the same headband for 5 days. In solidarity." |
| | | "The dojo is quiet. Too quiet. Rikizo sweeps the floor alone." |
| 7+ days | Over-the-top | "BREAKING: Local tanuki hasn't eaten in days. Claims student abandoned him." |
| | | "Rikizo started a diary. Day 7: 'I wonder if they found another sensei...'" |
| | | "Rikizo put up a 'MISSING STUDENT' poster. It's very dramatic." |
| 14+ days | Absurd | "Rikizo has started learning English out of spite. Please come back before it's too late." |
| | | "Rikizo auditioned for Duolingo. They said his guilt trips weren't aggressive enough." |
| | | "URGENT: Rikizo has formed a one-tanuki protest outside your phone. He has tiny signs." |

---

## Art Assets Needed

| Asset | Phase | Purpose | Priority |
|---|---|---|---|
| `rikizo_happy.png` | 1 | Streak milestone celebrations, widget delighted state | High |
| `rikizo_sad.png` | 1 | 3+ day absence notifications | High |
| `rikizo_icon_192.png` | 2 | Notification icon | High |
| `rikizo_icon_512.png` | 2 | App Store icon source | High |
| `rikizo_icon_1024.png` | 2 | App Store listing icon | High |
| `rikizo_desperate.png` | 3 | 7+ day absence widget/notifications (comedic) | Medium |
| `rikizo_determined.png` | 1 | Streak stage visuals (Week Warrior+) | Medium |
| `rikizo_celebrating.png` | 1 | Belt promotion moments | Medium |

Process via `RikizoArtPipeline.md`. The pipeline already has "4 calm + 4-5 intense expressions" planned which aligns with this need.

---

## Infrastructure Requirements

| Component | Service | Cost | Phase |
|---|---|---|---|
| Reminder backend | Cloudflare Worker + KV | Free tier (100k requests/day) | 2 |
| Email sending | Resend | Free tier (100 emails/day, 3000/mo) | 2 |
| Sender domain | Your domain or new rikizo domain | ~$12/year if new | 2 |
| Apple Developer account | developer.apple.com | $99/year | 2b |
| Google Play Developer account | play.google.com/console | $25 one-time | 2b |

---

## Step-by-Step Setup Guide

These are the steps that require your hands (account creation, credentials, signing, store submission). Claude can scaffold all the code and config, but these steps need a human in the loop.

### Step 1: Developer Accounts (do this first — approval takes time)

**Apple Developer Program:**
1. Go to https://developer.apple.com/programs/
2. Sign in with your Apple ID (or create one)
3. Enroll as an Individual ($99/year) — or Organization if you have a DUNS number
4. Complete identity verification (Apple may take 24-48 hours to approve)
5. Once approved, you'll have access to App Store Connect and can create certificates

**Google Play Developer:**
1. Go to https://play.google.com/console
2. Sign in with your Google account
3. Pay the one-time $25 registration fee
4. Complete identity verification
5. Immediately available to create app listings

### Step 2: Firebase Project (for push notifications)

1. Go to https://console.firebase.google.com/
2. Click "Add project" → name it (e.g., "rikizo-japanese")
3. **iOS setup:**
   - Go to Project Settings → General → Add App → iOS
   - Bundle ID: something like `com.rikizo.japanese` (pick this now, it's permanent)
   - Download `GoogleService-Info.plist` — Claude will place it in the Xcode project
4. **Android setup:**
   - Same page → Add App → Android
   - Package name: same as bundle ID (`com.rikizo.japanese`)
   - Download `google-services.json` — Claude will place it in the Android project
5. **Server key (for backend push sends):**
   - Go to Project Settings → Cloud Messaging
   - Note the Server Key (or set up a service account JSON for v1 API)
   - This goes into the Cloudflare Worker as a secret

### Step 3: Apple Push Notification Setup

1. In Apple Developer portal → Certificates, Identifiers & Profiles
2. **App ID:** Create a new App ID with your bundle ID, enable Push Notifications capability
3. **Push key (recommended over certificate):**
   - Go to Keys → Create a new key
   - Enable "Apple Push Notifications service (APNs)"
   - Download the `.p8` file (you can only download once — save it!)
   - Note the Key ID and your Team ID
   - These go into Firebase Console → Project Settings → Cloud Messaging → APNs auth key

### Step 4: Signing Certificates & Provisioning

**iOS (Xcode handles most of this automatically):**
1. Open the Capacitor Xcode project (Claude will generate this)
2. Go to Signing & Capabilities tab
3. Select your Apple Developer team
4. Xcode auto-creates the signing certificate and provisioning profile
5. Add Push Notifications capability (+ button)
6. Add App Groups capability (for widget shared storage): group ID = `group.com.rikizo.japanese`

**Android (keystore for release builds):**
1. Claude will provide the `keytool` command to generate a release keystore
2. You run it and set a password (save this — losing it means you can never update the app)
3. Claude will configure Gradle to use it for release builds

### Step 5: App Store & Play Store Submission

**Before first submission, prepare these assets (Claude can help spec them):**
- App name: e.g., "Rikizo Japanese" or "Japanese Master by Rikizo"
- App icon: 1024×1024 PNG (no transparency, no rounded corners for iOS)
- Screenshots: at least 2 per device size (iPhone 6.7", 6.5", iPad if applicable)
- Short description (80 chars) and full description (4000 chars)
- Privacy policy URL (required by both stores)
- App category: Education
- Age rating: probably 4+ / Everyone

**iOS (App Store Connect):**
1. Go to https://appstoreconnect.apple.com/
2. My Apps → New App → fill in name, bundle ID, SKU
3. Upload build from Xcode (Product → Archive → Distribute to App Store)
4. Fill in app metadata, screenshots, descriptions
5. Submit for review (typically 1-3 days, first submission may take longer)

**Android (Google Play Console):**
1. Go to Play Console → Create app
2. Fill in app details, content rating questionnaire, data safety form
3. Upload signed AAB (Android App Bundle) — Claude will configure the build
4. Create a production release
5. Submit for review (typically a few hours to 1 day)

### Step 6: Cloudflare Worker (push backend)

1. Create a Cloudflare account at https://dash.cloudflare.com/ (free)
2. Claude will write the Worker code and KV namespace config
3. You'll run `wrangler deploy` to publish it (Claude provides the commands)
4. Add Firebase server key as a Worker secret: `wrangler secret put FCM_SERVER_KEY`

### What Claude Builds vs What You Do

| Task | Claude builds | You do |
|---|---|---|
| Capacitor project scaffolding | ✅ | |
| iOS/Android project config | ✅ | |
| Push notification JS integration | ✅ | |
| Cloudflare Worker code | ✅ | |
| Widget extensions (Swift/Kotlin) | ✅ | |
| Native bridge plugin | ✅ | |
| Create developer accounts | | ✅ |
| Create Firebase project | | ✅ (guided) |
| Download credential files | | ✅ (guided) |
| Place credentials in project | ✅ (tells you where) | ✅ (copies files) |
| Generate Android keystore | | ✅ (Claude gives command) |
| Open Xcode and set signing team | | ✅ (guided) |
| Prepare app listing assets | ✅ (specs & copy) | ✅ (screenshots) |
| Submit to stores | | ✅ (guided) |
| Deploy Cloudflare Worker | | ✅ (Claude gives commands) |

---

## Dependencies Between Campaigns

| This campaign needs | From campaign | Status |
|---|---|---|
| Rikizo expression assets | `RikizoArtPipeline.md` | Can commission anytime |
| Godot game (Phase 4) | `campaigns/godot-migration.md` | Planning, Phase 1 not started |
| Content library growth | `campaigns/n4-completion.md`, `campaigns/n3-production.md` | Active |

| Other campaigns affected | Impact |
|---|---|
| `campaigns/godot-migration.md` | Phase 4 here depends on Godot reaching Phase 4-5. Add Capacitor integration notes to Godot campaign. |
