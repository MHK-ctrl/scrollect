# SCROLLECT

> **Your feed. Your rules.** — Interest-locked vertical Reels discovery from opted-in creators.

SCROLLECT is a premium Android app for discovering Reels **only** from creators who explicitly opt in via the official Instagram Graph API, filtered strictly by the interests you choose. No noise feed, no scraping, Play-Store-safe by construction.

**Status: MVP implemented and verified, production-hardened, Play-submittable.** Backend: 82/82 unit tests green, typecheck clean, readiness checks + revocation fix shipped. Android: mock/live debug + R8 release builds all green (SDK 35); release signing + version managed from `gradle.properties`. CI in `.github/workflows/ci.yml`.

## Repo layout

```
scrollect/
├── README.md                          ← you are here (implementation runbook)
├── SCROLLECT-SPEC.md                  ← THE binding spec (sections 1–8 + appendices)
├── .github/workflows/ci.yml           ← CI: backend + android mock/live jobs (artifacts, secret guard)
├── docs/
│   ├── privacy-policy-draft.md        ← copy-paste privacy policy (counsel-ready)
│   ├── play-store-review-notes.md     ← Play review notes + verbatim compliance statement
│   ├── PLAY-LISTING.md                ← Play listing package (copy, data safety, rating)
│   ├── LIVE-FLIP.md                   ← post-Meta-approval runbook (env, signing, sandbox, webhooks)
│   └── CDN-DECISION.md                ← Mux vs Cloudflare Stream decision (spec §A.1)
├── backend/                           ← Node 20+/TS · Fastify · Prisma · BullMQ
│   ├── src/                           ← config, lib (db, jwt, rateLimiter, tokenVault, cache), modules (auth, feed, interactions, moderation, ingestion, webhooks, classifier), seed
│   ├── test/                          ← 7 suites (82 tests) incl. classifier, rate limiter, token lifecycle, revocation purge, like/save idempotency, API smoke
│   ├── prisma/                        ← schema + migrations (incl. revokedAt)
│   └── .env.example                   ← all env keys documented (no secrets committed)
├── android/                           ← Kotlin 2 · Compose (Material3, VerticalPager) · Media3 · Hilt · Paging 3
│   └── app/src/                       ← main (theme, components, screens, data) + test + androidTest (FeedSmokeTest)
├── deploy/                            ← docker-compose (Postgres+Redis+backend), backend.Dockerfile
└── shared/api-contract.md             ← API contract used by backend + Android remote repo
```

## How to run the backend (MOCK_MODE — zero Meta setup)

1. `cd backend && cp .env.example .env` (MOCK_MODE=true is the default; no secrets needed).
2. Postgres + Redis: `docker compose -f ../deploy/docker-compose.yml up -d postgres redis`
   — or use local Homebrew Postgres with `DATABASE_URL=postgresql://$(whoami)@localhost:5432/scrollect`.
3. `npm install && npm run db:generate`
4. `npm run migrate` (applies Prisma migrations; creates the `scrollect` DB if configured).
5. `npm run dev` → server on `:8080`. Check `curl localhost:8080/healthz` → `{"status":"ok","mockMode":true,"checks":{"db":"up","redis":"skipped"}}`. With Postgres/Redis reachable, `checks` reports `up`/`up`; a downed store returns HTTP 503 + `status:"degraded"` so orchestrators can stop routing traffic.

MOCK_MODE seeds deterministic creators + Reels (classified through the real pipeline), so the feed API is populated immediately. To run live: set `MOCK_MODE=false` and fill the Instagram + `JWT_SECRET`/`ENCRYPTION_KEY`/`DATABASE_URL` env vars (live mode now **fails fast** if `JWT_SECRET` is missing or the dev default).

Run tests/coverage: `npm test` · `npm run test:coverage` (classifier + rate limiter at 100% statement coverage).

## How to run the Android app (flavors: `mock` default, `live`)

The app has two **build flavors** — switching is a flavor selection, never a code edit:

| Flavor | MOCK_MODE | Repository | Requires |
|---|---|---|---|
| `mock` (default) | `true` | offline `MockRepository` (seeded) | nothing — zero config |
| `live` | `false` | `RemoteRepository` → backend API | `scrollect.liveBaseUrl` (else build fails fast) |

**Android Studio:** 1) open `android/` · 2) open **Build Variants** panel (View → Tool Windows → Build Variants) · 3) select **mockDebug** (default) or **liveDebug**. Sync Gradle after switching.

**CLI:**
- Mock (offline, default): `./gradlew :app:assembleMockDebug` → APK at `app/build/outputs/apk/mock/debug/app-mock-debug.apk`
- Live (needs a base URL): `./gradlew :app:assembleLiveDebug -Pscrollect.liveBaseUrl=http://10.0.2.2:8080` → APK at `app/build/outputs/apk/live/debug/app-live-debug.apk`

`scrollect.liveBaseUrl` can come from `-P` (CLI/CI), `gradle.properties`, or `local.properties`. If it's missing, the live flavor **fails at build time with a clear message** — it never silently falls back to mock. The base URL is never hardcoded in code; tokens/keys stay in backend env or keystore-backed storage (see `SessionManager`).

> **Config-cache note:** all `scrollect.*` values (liveBaseUrl, versionCode, versionName) and `local.properties` are read at Gradle **configuration time**. After editing `gradle.properties`/`local.properties`, do a Gradle sync or restart the daemon — a plain incremental build will not pick up new values.

## CI

`.github/workflows/ci.yml` runs on push to `main` and every PR (docs-only changes skip it; superseded runs are cancelled):

| Job | Runs | Artifact |
|---|---|---|
| **backend** | `npm ci` → `npx tsc --noEmit` → `npm test` (no DB needed) | — |
| **android-mock** | `assembleMockDebug` → `testMockDebugUnitTest` → `assembleMockDebugAndroidTest` | `app-mock-debug.apk` (7 days) |
| **android-live** | `assembleLiveDebug` + `testLiveDebugUnitTest` with `-Pscrollect.liveBaseUrl` from the `SCROLLECT_LIVE_BASE_URL` secret | `app-live-debug.apk` (7 days) |

The live job **fails with a clear error if the secret is unset** — it never skips or falls back to mock. (Consequence: PRs from forks, which don't inherit secrets, fail that job by design.) Per-job `paths` filters mean a backend-only PR runs only the backend job.

## Release builds & signing

- **Version (single source of truth):** `gradle.properties` → `scrollect.versionCode=1`, `scrollect.versionName=1.0.0` — read by `app/build.gradle.kts`. Bump there before each Play upload.
- **R8:** release builds run full minification + resource shrinking (`isMinifyEnabled`/`isShrinkResources`); kotlinx.serialization/Hilt keep rules are in `app/proguard-rules.pro`. Verified: debug APKs ~22 MB → release ~2.6 MB.
- **Signing:** release is signed only when `android/keystore.properties` (gitignored) or the `SCROLLECT_KEYSTORE_PATH` / `SCROLLECT_STORE_PASSWORD` / `SCROLLECT_KEY_ALIAS` / `SCROLLECT_KEY_PASSWORD` env vars are present; otherwise it builds unsigned with a warning. Generate the keystore once with:
  ```bash
  keytool -genkeypair -v -keystore scrollect-release.jks -alias scrollect -keyalg RSA -keysize 2048 -validity 10000
  ```
  **Play App Signing** lets the upload key differ from Google's signing key — enable it in Play Console before the first upload. Full checklist: `docs/LIVE-FLIP.md` Phase A.2.

Walk the mock flow: Splash → Onboarding (pick 3–8 interests) → vertical feed (double-tap like, pills switch category) → Settings. Swipe down on a card → Creator profile.

Tests: `./gradlew :app:testMockDebugUnitTest` (mock, offline) · `./gradlew :app:testLiveDebugUnitTest -Pscrollect.liveBaseUrl=http://10.0.2.2:8080` (live wiring smoke). Instrumented smoke test (onboarding → feed renders seeded data — **mock flavor only**, lives in `src/androidTestMock` so it can never run against the live backend): `./gradlew :app:assembleMockDebugAndroidTest`, then run `FeedSmokeTest` on an emulator/device.

## Meta setup (to go live — spec §2 is the runbook, `docs/LIVE-FLIP.md` is the post-approval flip)

1. Create a Meta app → Business type → add the Instagram product.
2. **Business Verification** (required for Advanced Access; announced Feb 2023, enforced for new apps since Dec 2024) — start it Day 1, lead time 1–3 weeks.
3. Add permissions `instagram_basic` + `instagram_content_publish`, request **Advanced Access** for each.
4. Submit App Review with a video walkthrough of the OAuth + ingestion flow.
5. Fill `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET` / `INSTAGRAM_REDIRECT_URI` (+ `JWT_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, optional `REDIS_URL`) and set `MOCK_MODE=false`.

After approval, follow `docs/LIVE-FLIP.md` top-to-bottom: env vars → Android flavor flip → Meta sandbox exercise → webhooks → ship checklist.

## What's stubbed / pending (blocked on Meta approval or out of MVP)

- **Live Instagram OAuth + real ingestion** — code exists (`LiveIgClient`, token lifecycle, webhook receiver) but is untested against Meta until Advanced Access + real credentials land. Exercise first in Meta's sandbox.
- **Business Verification / App Review / Advanced Access** — external, 1–3+ week lead; nothing in code can unblock it.
- **Video CDN (Mux / Cloudflare Stream) playback** — mock items use public sample MP4s; swap `MOCK` urls for real CDN urls in live mode. Decision + cost model: `docs/CDN-DECISION.md` (Mux recommended for MVP). Mux/Stream env keys are documented in `.env.example`; integration stays behind a `MediaStorage` interface.
- **Redis-backed rate buckets & cache in prod** — memory stores are used in mock; set `REDIS_URL` to enable Redis stores.
- **Play listing + Data Safety form** — use `docs/play-store-review-notes.md`.
- **V2 (excluded by scope):** comments, push, payouts, CV tagging, light mode, tablet/web.

## Known limitations (documented, MVP-acceptable)

- ✅ **Fixed (2026-08-06):** revocation purge now keys off a `revokedAt` column (migration `20260806000000_add_revoked_at`) — content is purged **exactly 24h after revocation** (spec §2.5), not after creation. Legacy rows (revoked before the migration) fall back to `createdAt`. Covered by `backend/test/revocation.test.ts` (5 tests).
- **Android app ships the offline mock repo by default** — the remote repo is wired and compiles but is exercised only when you flip DI.
- **`video_url`-omitted Reels (licensed audio)** render as thumbnail+caption **card mode** (`isCardMode`) — verified end-to-end in seed data and the Android feed.

## Non-negotiable rules (from legal/technical research — do not violate)

- **No scraping, ever.** Only official Meta APIs. Verbatim compliance statement: `SCROLLECT-SPEC.md` §2.6 and `docs/play-store-review-notes.md`.
- **No personal-feed access** — the app is an opt-in creator network by construction (creator-account gate in the OAuth path).
- **Rate limits** — token-bucket budget of 200 calls/user/hour with exponential backoff + `since`-sync + webhooks (§2.4).
- **`video_url` absent for licensed-audio Reels** — card mode (§3.4).
- **Content stays creator-owned** — stored only with authorization; 24h purge on revocation.
- **No hardcoded secrets** — everything comes from env (`.env.example` documents all keys); logger redacts tokens/PII.
- **Isolation:** everything lives under `scrollect/`. Nothing outside it was read or modified during implementation.
