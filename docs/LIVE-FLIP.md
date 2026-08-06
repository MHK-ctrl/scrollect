# SCROLLECT — LIVE-FLIP Runbook (post-approval)

**Audience:** the whole team. **When:** after Meta App Review grants Advanced
Access for `instagram_basic` (and Business Verification completes). Until then,
the app ships in **MOCK_MODE** with zero Meta credentials — do not flip anything
below early; live mode fails fast on missing config by design.

**Source of truth:** `SCROLLECT-SPEC.md` §2 (Meta runbook, rate-limit budget,
token lifecycle) · `docs/privacy-policy-draft.md` (live at
`https://scrollect-privacy.vercel.app`) · `docs/play-store-review-notes.md`
(compliance statements) · `docs/PLAY-LISTING.md` (store package).

---

## Phase A — Credentials & environment

### A.1 Backend env vars (`scrollect/backend/.env` — copy of `.env.example`)

| Var | Value | Where to get it |
|---|---|---|
| `MOCK_MODE` | `false` | — |
| `INSTAGRAM_APP_ID` | Meta app ID | developers.facebook.com/apps → your Business app → Settings → Basic |
| `INSTAGRAM_APP_SECRET` | Meta app secret | same page (App secret → Show) |
| `INSTAGRAM_REDIRECT_URI` | `https://api.scrollect.app/api/v1/auth/ig/callback` | **must match exactly** the *Valid OAuth Redirect URIs* value in the Meta dashboard — note the `/api/v1` path segment (the backend route is `POST /api/v1/auth/ig/callback`); a mismatch = OAuth redirect 404 |
| `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` | long random string | `openssl rand -hex 16` — also the webhook verify token (Phase D) |
| `JWT_SECRET` | `openssl rand -hex 32` | — |
| `ENCRYPTION_KEY` | `openssl rand -hex 32` (AES-256-GCM token vault) | — |
| `DATABASE_URL` | Postgres 16 URL | deploy/docker-compose.yml or Neon/Railway |
| `REDIS_URL` | Redis URL (optional in mock, **required in prod** for rate buckets + queues) | Upstash/Redis Cloud/Railway |
| `LOG_LEVEL` | `info` (prod) | — |

Store these in the host's secret manager, **never in git** (`.env` is
gitignored; `config.ts` fails fast in live mode if `JWT_SECRET`/`ENCRYPTION_KEY`
are missing or dev defaults).

### A.2 Android signing (release builds)

Generate the keystore **once**, locally, and store it in a password manager:

```bash
keytool -genkeypair -v -keystore scrollect-release.jks -alias scrollect \
  -keyalg RSA -keysize 2048 -validity 10000
```

Then create `scrollect/android/keystore.properties` (gitignored):

```properties
storeFile=/absolute/path/to/scrollect-release.jks
storePassword=<store password>
keyAlias=scrollect
keyPassword=<key password>
```

CI uses env vars instead: `SCROLLECT_KEYSTORE_PATH`, `SCROLLECT_STORE_PASSWORD`,
`SCROLLECT_KEY_ALIAS`, `SCROLLECT_KEY_PASSWORD`.

> **Play App Signing:** Google re-signs your AAB with their app-signing key on
> upload. The **upload key** (this keystore) can be different from the signing
> key; keep the upload key safe (a lost upload key needs an account-recovery
> request). You can also let Play generate a new upload key from Play Console.
> Enable Play App Signing in Play Console → Setup → App signing **before** the
> first upload, and note the SHA-256 fingerprints are NOT required for Play but
> ARE required if you ever use Facebook/Meta SSO.

---

## Phase B — Android flavor flip

The app has `mock` (offline, seeded) and `live` (real backend) flavors — flipping
is a build selection, never a code change.

1. **Build variant:** Android Studio → Build Variants → **liveDebug** (or `-P` on
   CLI). The `live` flavor **fails fast** if `scrollect.liveBaseUrl` is unset.
2. **Base URL sources** (priority): `-Pscrollect.liveBaseUrl=…` (CI/CLI) →
   `gradle.properties` → `local.properties`. For prod, set
   `scrollect.liveBaseUrl=https://api.scrollect.app` in `gradle.properties`
   (committed, non-secret) or pass it in CI.
3. **Verify the flip:**
   ```bash
   ./gradlew :app:testLiveDebugUnitTest -Pscrollect.liveBaseUrl=https://api.scrollect.app
   ./gradlew :app:assembleLiveDebug -Pscrollect.liveBaseUrl=https://api.scrollect.app
   ```
4. `LiveModule`/`RemoteRepository` now talk to the real backend; `MockModule` is
   compiled out of the live APK. The instrumented `FeedSmokeTest` lives in
   `src/androidTestMock` so it physically cannot run against live.

> **Config-cache note:** `local.properties` and `gradle.properties` are read at
> Gradle **configuration time**. After editing them, do a Gradle sync / restart
> the daemon — an incremental build will not pick up new values.

---

## Phase C — Meta sandbox exercise (before real users)

Meta grants **Development-mode** access for app admins/roles/testers the moment
the Instagram product is added — use it to exercise the whole live pipeline
**before** Advanced Access lands:

1. Add 2 **Instagram test accounts** (Business/Creator type) in the app
   dashboard → **App Roles → Test Users → Add Instagram test account**.
2. Configure **Valid OAuth Redirect URIs** with
   `https://api.scrollect.app/api/v1/auth/ig/callback` (must equal
   `INSTAGRAM_REDIRECT_URI` in `.env`); enable Client OAuth + Web OAuth
   Login (spec §2.1).
3. With `MOCK_MODE=false` + test credentials in `.env`, run the backend and walk
   the OAuth flow as a test account: `POST /api/v1/auth/ig/start` →
   Instagram consent → `POST /api/v1/auth/ig/callback` (`{code, state}`).
4. Verify: `GET /api/v1/auth/me` returns the creator profile; `GET /me`-gate
   rejects `PERSONAL` accounts; token vault stores AES-256-GCM-encrypted tokens;
   ingestion worker syncs the test account's own media (`since`-based,
   ≤ 200 calls/user/hr budget, spec §2.4); `isCardMode` set for licensed-audio
   Reels; `POST /api/v1/creators/:id/revoke` marks media `revoked` and the
   `revokedAt` purge removes it exactly 24h later (spec §2.5).
5. **Rate-limit check:** confirm the token-bucket limiter + backoff table
   (error 4 → global pause; error 613 → per-creator backoff 60s→600s) engage.

Do NOT rely on mock data for this — the mock client never hits Meta.

---

## Phase D — Webhook configuration (after Advanced Access)

Per spec §2.4, `since`-sync remains the MVP source of truth; webhooks are the
V2 push enabler. To wire them now (backend receiver already exists):

1. App dashboard → **Instagram product → Webhooks** → Subscribe.
2. **Callback URL:** `https://api.scrollect.app/webhooks/instagram`
3. **Verify token:** the same `INSTAGRAM_WEBHOOK_VERIFY_TOKEN` from `.env`
   (the receiver answers the `hub.challenge` handshake).
4. Re-verify the current field list — spec §2.4: `comments`, `mentions`,
   `messaging`, `story_insights`, etc.; a dedicated new-media push field is NOT
   standard — so keep `since`-sync as the source of truth regardless.
5. All POSTs are HMAC-signed (`X-Hub-Signature-256`); mismatches are dropped +
   logged + alerted (spec §1.4 failure table).

---

## Phase E — Ship checklist (everything before the Play upload)

- [ ] CI green on `main` (`.github/workflows/ci.yml` — backend + mock + live jobs)
- [ ] `MOCK_MODE=false` + real env vars in the host secret manager (Phase A)
- [ ] Backend `/healthz` returns `status: ok` with `checks: {db: up, redis: up}`
- [ ] Privacy policy live at `https://scrollect-privacy.vercel.app`; data-deletion
      instructions + privacy URL added to the Meta app dashboard (spec §2.1 step 8)
- [ ] Live flavor exercised in Meta's sandbox with 2 test accounts (Phase C)
- [ ] Release APK/AAB signed (Phase A.2) and version bumped in `gradle.properties`
- [ ] Play App Signing enabled; upload key registered (Phase A.2)
- [ ] Play listing complete (`docs/PLAY-LISTING.md`): copy, screenshots, Data
      Safety form, content rating Teen, no-ads + UGC moderation declarations
- [ ] Compliance statements pasted verbatim in Play review notes
      (`docs/play-store-review-notes.md` §1 + §4)
- [ ] 24h revocation purge verified against a real revoke
- [ ] Monitoring: `LOG_LEVEL=info` structured logs, redaction active, Sentry wired
- [ ] CDN decision made and pipeline behind a `MediaStorage` interface
      (`docs/CDN-DECISION.md` — keys stay in env, deferred until playback volume)

**Out of scope (flag, don't build):** comments/push/payouts/CV-tagging/light
mode/tablet+web player and webhooks-as-sole-sync — all V2 (spec §5.2).
