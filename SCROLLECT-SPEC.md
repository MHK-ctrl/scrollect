# SCROLLECT — Buildable Product Specification

**v1.0 · 2026-08-03 · Status: Ready for Day-1 coding**
**Owner:** Product/Architecture · **Target platform:** Android (Jetpack Compose) + Node.js backend
**Companion files:** `README.md` · `docs/privacy-policy-draft.md` · `docs/play-store-review-notes.md`

> **How to read this document.** This is the single structured deliverable for the SCROLLECT build. Sections 1–7 map 1:1 to the seven required deliverables; Section 8 is the "Decisions Needed Before Day 1" gate. A 3-person team (1 Android, 1 backend, 1 full-stack/QA) can start coding from this document alone.

---

## 0. Executive Summary

**SCROLLECT** ("scroll + select + collect") is a premium, interest-locked vertical Reels discovery app. Users pick 3–8 interests at onboarding, then see **only** Reels matching those topics, sourced from **opted-in creators** who authenticate through the official Instagram Graph API. No personal-feed scraping, no noise feed — a curated, category-locked experience with a Gen-Z-native, glassmorphic design system.

**Working name shortlist (decide in §8):**

| Name | Rationale | Risk |
|---|---|---|
| **SCROLLECT** | Original; literal (scroll + select + collect); memorable | Slightly long for a wordmark |
| **TUNED** | Short, verb-ish; "tune your feed"; app-store friendly | Common word (trademark check needed) |
| **SPLICE** | Remix/meme-culture energy; native Gen-Z | May read as "editing tool" |
| **CURIO** | "Curiosity" + "curated"; premium tone | Softer vibe |

**Thesis to validate (drives MVP scope in §5):** *Interest-filtered discovery of opted-in creator content produces higher activation and retention than algorithmic noise.* Metrics: onboarding completion → first-feed engagement; D7/D30 retention; creators-willing-to-OAuth conversion.

**Non-negotiable compliance posture (from prior legal research, do not contradict):**
1. **No scraping. Ever.** Only official Meta APIs (`instagram_business_basic`, `instagram_business_content_publish`).
2. **No personal-feed access.** No official API exposes a user's personalized Reels feed → the app *cannot* be a feed-scraper by construction.
3. **Opt-In Creator Network.** Creators authenticate via Instagram Login/Graph API; the app ingests *their authorized* media only.
4. **Rate limits are real** — Meta's official Instagram Platform limit is impression-based (`Calls within 24h = 4800 × Number of Impressions`); SCROLLECT additionally budgets a conservative **200 calls/user/hour** floor with exponential backoff. Ingestion is incremental (`since`-based), webhook-assisted, backoff-protected.
5. **`video_url` gap is real** — Reels using licensed audio omit `video_url`. Fallback: immersive thumbnail+caption card mode, or restrict ingestion to original-audio Reels (configurable).
6. **Copyright stays with the creator.** Video is stored only with explicit authorization; 24h takedown on revocation.

---

## 1. System Architecture

### 1.1 End-to-end flow

```
 CREATORS (opt-in)                                        VIEWERS (Android)
 ┌───────────────────────────┐                          ┌───────────────────────────────┐
 │ Instagram app · IG Login  │                          │ SCROLLECT app (Kotlin/Compose)│
 │ OAuth consent screen      │                          │ Splash → Onboarding → Feed    │
 └─────────────┬─────────────┘                          │ VerticalPager + Media3 · pills│
               │ 1. OAuth authorize                       │ like/save · creator sheet     │
               │    (scopes: see §2.1)                    │ settings                      │
               │                                          └───────────────┬───────────────┘
               ▼                                                          │ 6. JWT API calls
 ┌────────────────────────────────────────────────────────────────────────┴──────────────┐
 │                              BACKEND (Node.js 22 + TS, Fly.io/Railway)                │
 │  ┌───────────────┐ ┌────────────────────┐ ┌──────────────────────┐ ┌───────────────┐  │
 │  │ Auth / OAuth  │ │ Ingestion worker   │ │ Classifier service   │ │ Feed service  │  │
 │  │ code exchange │ │ (BullMQ + Redis)   │ │ lexical (always) +   │ │ category feeds│  │
 │  │ token vault   │ │ incremental since  │ │ CV/LLM (on-demand)   │ │ related cat.  │  │
 │  │ (AES-GCM)     │ │ webhook receiver   │ │ moderation queue     │ │ likes · saves  │  │
 │  └───────────────┘ └─────────┬──────────┘ └──────────┬───────────┘ └───────┬───────┘  │
 │  ┌───────────────────────────▼──────────┐ ┌──────────▼────────────────────▼───────┐  │
 │  │ Media service: proxy download →      │ │ PostgreSQL (users, creators, media,   │  │
 │  │ transcode → signed URLs · watermark  │ │ tags, likes, reports, moderation)      │  │
 │  │ CDN cache 24h · purge on revoke      │ │ Redis (queues, feed cache, rate-limit  │  │
 │  └───────────────────────────┬──────────┘ │ buckets, seen-sets)                    │  │
 └──────────────────────────────┼─────────────┴───────────────────────────────────────┘
                                │ 2. GET /{ig-user}/media?since=… (creator token)
                                │ 3. GET /{media-id}?fields=…  (metadata)
                                ▼
                ┌───────────────────────────────┐
                │ Instagram Graph API (official)│  ← the ONLY source of creator content
                │ 200 calls/user/hr · error 4,  │
                │ 613, 190 · video_url may be   │
                │ absent for licensed audio     │
                └───────────────────────────────┘
                ┌───────────────────────────────┐
                │ Video pipeline                │
                │ Cloudflare Stream or Mux      │
                │ HLS adaptive bitrate          │
                │ R2/S3 origin (raw media)      │
                └───────────────────────────────┘
```

### 1.2 Component & stack decisions

| Layer | Choice | Why |
|---|---|---|
| Android client | Kotlin 2.x · Jetpack Compose (foundation **1.7+** → `VerticalPager`) · Media3 ExoPlayer · Material3 · Hilt · Coil · Room (offline cache) · DataStore · Ktor/Retrofit | Native 60fps vertical pager, haptics, dynamic color; Media3 is the standard for video |
| Backend | Node.js 22 + TypeScript + Fastify · Prisma · BullMQ + Redis | One language across backend + web player (V2); fastest iteration for a 3-person team |
| Database | PostgreSQL (Neon/Supabase at MVP) + Redis | Relational media/tag model; Redis for queues, seen-sets, rate buckets |
| Video | **Mux or Cloudflare Stream** (choice in §8) · R2 origin | Managed HLS transcoding + CDN; avoids building a transcode farm; prices verified §A.1 |
| Classifier | Lexical stage (free) + `gpt-4o-mini` vision stage (pay-per-use) MVP; self-hosted CLIP at scale | Fastest-to-ship hybrid; cost model in §A.2 |
| Deploy | Fly.io or Railway (2 small instances: API + worker) | Cheap, container-friendly, minimal ops |
| Observability | Sentry + OpenTelemetry + Grafana dashboards | Crash + rate-limit + cost visibility |

### 1.3 Server-side vs client-side processing (decision)

**Decision: server-side classification and moderation. Client does presentation + caching only.**

- **Tags must be computed once** and shared across all users, devices, and feeds. On-device CV would re-run inference per device and can't enforce moderation (Play policy requires server-side UGC moderation anyway).
- **Policy is server-enforced:** moderation queue, takedowns, and category changes apply instantly everywhere.
- **Cost tradeoff (quantified in §A.2):** server classification ≈ **$0.0004/video** (LLM stage, only ~15% of videos) → ~$2.40/mo at 6,000 videos/mo. On-device inference trades battery, fragmentation (GPU/CoreML per device), and unshippable moderation for a cost that never reaches zero. Server-side wins on every axis except a small per-video fee.
- Client keeps only: 24h media cache (Room + Media3 `SimpleCache` LRU 512 MB), like/save writes, offline skeleton states.

### 1.4 Exact Meta APIs: used · blocked · failure modes

**Used (all official, documented, Play-safe):**

| Capability | Endpoint | Scope | When |
|---|---|---|---|
| Creator identity | `GET /me?fields=user_id,username,account_type,media_count` | `instagram_business_basic` | Post-OAuth |
| List own media (incremental) | `GET /{ig-user-id}/media?fields=id,timestamp&since=&until=&limit=50` | `instagram_business_basic` | Sync worker |
| Media detail | `GET /{media-id}?fields=id,caption,media_type,media_url,thumbnail_url,video_url,permalink,timestamp,like_count,comments_count` | `instagram_business_basic` | Ingestion |
| **OAuth** | `https://api.instagram.com/oauth/authorize` + `/oauth/access_token` + `/graph.instagram.com/access_token` (`ig_exchange_token`) | — | Creator onboarding |
| Webhooks (V2, optional) | `comments` / `mentions` / `messaging` subscriptions (documented fields; a new-media push field is not standard — verify before V2) | `instagram_manage_comments` (comments) | Push-style refresh |
| Publish-to-IG ("share back") | `POST /{ig-user-id}/media` → `POST /{media-id}/media_publish` | `instagram_business_content_publish` | V2 feature |

**Blocked / never used (with reason):**

| Capability | Status | Reason |
|---|---|---|
| User's personalized Reels feed / recommendations | ❌ Impossible | No official API exposes it. The app's architecture (opt-in network) makes this moot. |
| Hashtag search / public post search | ❌ Deprecated | `hashtag_search` was removed from the Instagram API; not part of this design. |
| Any third account's media without their token | ❌ Impossible | Tokens are per-user; scopes are granted per authenticated user. |
| Private-account content | ❌ Never | Access requires the account owner's own token. |
| Scraping / headless browser / unofficial endpoints | ❌ Prohibited | Meta ToS §3.2 + Google Play rejection risk; see §2.6 verbatim statement. |

**Failure modes & handling (backend must handle every row):**

| Failure | Signal | Handling |
|---|---|---|
| Token expired/revoked | Error 190 | Halt creator sync; notify via email/push; request re-auth (link expires in 7 days) |
| App rate limit | Error 4 | Global circuit breaker; exponential backoff 60s→120s→300s→600s cap; alert |
| Per-user rate limit | Error 613 | Backoff per creator; requeue job with delay; never hammer |
| Permission not granted | Error 10 | Ensure scope requested at authorize; guide re-auth |
| Media deleted by creator | Error 100 (invalid) / 200 | Mark `deleted`; purge from feeds within 24h |
| `video_url` absent (licensed audio) | Field null | Fallback card mode (§3.4) or original-audio-only filter |
| Webhook signature mismatch | `X-Hub-Signature-256` | Drop + log + alert (400) |

---

## 2. API Integration & Legal Strategy (Runbook)

### 2.1 Meta app setup — step by step

> Start **Week 1, Day 1**. App Review + Business Verification have 1–3 week external lead times; file early.

1. **Create a Meta Business Portfolio** (business.facebook.com). Required for Instagram Login apps.
2. **Create an app** with type **Business**, then add the **Instagram** product → choose **"Instagram API with Instagram Login"**.
3. **Configure OAuth:** add `https://api.scrollect.app/api/v1/auth/ig/callback` to *Valid OAuth Redirect URIs*; enable *Client OAuth* + *Web OAuth Login*; add the SCROLLECT domain to *Valid OAuth domains*.
4. **Request permissions:** `instagram_business_basic` (required) + `instagram_business_content_publish` (only if V2 share-back ships; request only what you ship — reviewers check).

   > **Scope-name note:** `instagram_business_basic` is the current name of the permission formerly called `instagram_basic`; the App Review filing should request `instagram_business_basic`. Likewise, the V2 publish permission is now `instagram_business_content_publish` (formerly `instagram_content_publish`).
5. **Development mode:** standard access works for app admins/roles/testers — enough to build and demo.
6. **App Review:** submit each permission with a screencast of the real flow + written use case ("we read a creator's own Reels metadata only after they opt in via Instagram Login, to power a category feed"). Provide 2 test accounts.
7. **Advanced Access** is granted per permission after approval (turns on Live mode for real users).
8. **Business Verification** (required for Advanced Access since **February 1, 2023**; free; ~1–2 weeks; document-based route for small companies). Add Privacy Policy URL + data-deletion instructions to the app dashboard *before* going live.

### 2.2 Creator OAuth flow (exact calls)

```
[Client]  →  https://api.instagram.com/oauth/authorize
             ?client_id={APP_ID}&redirect_uri=https://api.scrollect.app/api/v1/auth/ig/callback
             &scope=instagram_business_basic&response_type=code&state={CSRF_state}
[Creator] grants consent on Instagram
[Client]  →  POST https://api.instagram.com/oauth/access_token
             {client_id, client_secret, grant_type=authorization_code,
              redirect_uri, code}
             → short-lived token (1h) + user_id
[Backend] →  POST https://graph.instagram.com/access_token
             {grant_type=ig_exchange_token, access_token=<short-lived>}
             → long-lived token (60 days)
[Backend] →  GET  https://graph.instagram.com/me
             ?fields=user_id,username,account_type,media_count
             → confirm identity; upsert Creator row
[Backend] →  Kick off initial sync (fast loop, every 5 min, ≤ 4 passes)
```

- **Creator-account gate (do not skip):** the Graph API exposes media only for **Business / Creator (professional) accounts** — `account_type` = `PERSONAL` accounts cannot be read via `/{ig-user-id}/media`. After `GET /me`, check `account_type`; if `PERSONAL`, pause onboarding and guide the creator to switch to a **Creator account** (Instagram Settings → Account type) inside the app. Without this gate, a meaningful share of seed creators will silently fail ingestion.

- **`state`** = cryptographically random CSRF token; verified on callback.
- **Tokens never leave the backend.** Client only holds an auth code. Tokens stored AES-256-GCM at rest; secret in env/KMS; masked in logs.
- **Instagram Login vs Facebook Login:** use **Instagram Login only**. Facebook Login adds an unneeded path and review surface; Instagram Login scopes cover everything the app does.

### 2.3 Token lifecycle

| State | Trigger | Action |
|---|---|---|
| `active` | exchanged/refreshed | Normal sync |
| `expiring` | T-10 days | Proactive refresh (`ig_exchange_token` with current long-lived token) |
| `refresh_failed` | 3 attempts | Email creator: "reconnect Instagram to keep your Reels live" (deep link re-auth) |
| `expired` | error 190 or past expiry | Suspend sync; keep content 30d grace, then purge per §2.5 |
| `revoked` | creator revoked in IG / webhook | Purge media within **24h**; notify user-side |

### 2.4 Rate-limit budget & sync design

**Rate limits:** Meta's current official Instagram Platform limit is impression-based — `Calls within 24 hours = 4800 × Number of Impressions` (developers.facebook.com/docs/graph-api/overview/rate-limiting). To stay safely inside it (and inside the older static 200 calls/user/hour cap), SCROLLECT budgets a conservative **200 calls per user per hour** as a hard floor, with **exponential backoff** on any throttling signal. Design targets the tighter interpretation.

- **One sync pass ≈ 51 calls** (1 list page `limit=50` + 50 detail calls). → a creator can be fully synced **~3×/hour** without touching other work.
- **Steady state:** one sync per creator per **30 min** (≈2 calls/min budget). **Backfill:** on onboarding, 5-min loop × 4 passes (20 min catch-up).
- **Incremental (never full):** list page uses `since=<last_sync_ts>`; only changed IDs get detail fetches. Track `last_media_timestamp` per creator.
- **Webhooks (V2 enabler, not MVP blocker):** the documented Instagram webhook fields are `comments`, `mentions`, `messaging`, `messaging_seen`, `story_insights`, `live_comments` — a dedicated “new media” push field is **not standard**, so re-verify the current field list before building V2 webhooks. For MVP, `since`-sync is the sole source of truth (webhooks may be lost). Verify `X-Hub-Signature-256` HMAC on any webhook endpoint.
- **Backoff table:** `error 4` → global pause + alert; `error 613` → per-creator backoff (60s → 120s → 300s → 600s cap); `error 190` → token state machine (§2.3); other 4xx → log + skip + alert if repeated.
- **Quota guardrails:** per-creator daily cap; per-app dashboard metric (`calls/hour`); alert at 80% of 200/hr * app-wide allowance.

### 2.5 Caching policy (24h content-cache rule)

- **Metadata cache:** 24h TTL; refreshed on demand when counts/follower metrics change (V2 insights).
- **Thumbnails:** CDN-cached with `Cache-Control: public, max-age=86400`; signed playback URLs expire in 15 min.
- **Video:** stored in the pipeline only with explicit creator authorization; **purge within 24h** of revocation, takedown, or DMCA (nightly job + webhook-triggered immediate purge).
- **Device:** Media3 `SimpleCache` (LRU 512 MB) + Room for feed metadata → offline skeletons with cached captions.

### 2.6 Anti-scraping compliance statement (verbatim — also in Play review notes)

> **SCROLLECT compliance statement (include verbatim in Play Store review notes and privacy policy):**
>
> SCROLLECT is an opt-in creator discovery network. It does **not** scrape, crawl, or collect data from Instagram without explicit authorization, and it never will. Every video in the SCROLLECT feed is published by a creator who has (a) authenticated with their own Instagram account through the official Instagram Login, (b) granted access via the official Instagram Graph API scope `instagram_business_basic`, and (c) affirmatively opted in to distribution through SCROLLECT. Content is accessed exclusively through Meta's official, documented APIs in compliance with the Instagram Platform Policies. SCROLLECT never: collects personal feeds or recommendations; accesses private accounts; uses headless browsers, proxies, unofficial endpoints, or credential stuffing; bypasses or evades rate limits; or redistributes content without the creator's authorization. Creators may revoke access at any time, and SCROLLECT removes their content within 24 hours of revocation.

---

## 3. Content Classification & Filtering

### 3.1 Category taxonomy (MVP — 14 categories)

| # | Category | Emoji | Adjacent (for “related”) suggestions |
|---|---|---|---|
| 1 | Education | 🎓 | Science, Tech |
| 2 | Tech | 📱 | Science, Finance |
| 3 | Cars | 🏎️ | DIY, Travel |
| 4 | Fashion | 🧥 | Beauty, Art & Design |
| 5 | Fitness | 💪 | Food, Sports |
| 6 | Food | 🍜 | Travel, Fitness |
| 7 | Travel | 🌍 | Nature/Outdoors, Food |
| 8 | Gaming | 🎮 | Tech, Comedy |
| 9 | Music | 🎧 | Comedy, Art & Design |
| 10 | Art & Design | 🎨 | Fashion, Music |
| 11 | Comedy | 😂 | Gaming, Pets |
| 12 | Finance | 💰 | Tech, Education |
| 13 | Pets | 🐾 | Comedy, Nature |
| 14 | Science | 🔬 | Education, Tech |

Categories are stored as a static table (`categories(id, slug, emoji, accent, adjacent[])`) so the taxonomy can evolve without code deploys. (Final set = Decision §8-2.)

### 3.2 Hybrid classifier design

**Stage 1 — Lexical (runs on 100% of items, cost ≈ $0):**

- Inputs: `caption`, `hashtags[]` (parsed from caption), `creator.bio`, `creator.username`.
- Keyword lexicon per category (curated, ~80–150 terms each, seed list in repo `classifier/lexicons/*.json`). Weighted scoring:

| Signal | Weight |
|---|---|
| Exact category hashtag (`#cars`) | 3.0 |
| Keyword match in caption | 2.0 |
| Lemma/stem match (e.g., “drift·ing”) | 1.5 |
| Creator bio keyword | 1.0 |

- Normalize: `raw_score / max_possible_for_signal_count` → `conf_lex ∈ [0,1]` per category.
- **Multi-tag:** keep the top-3 categories above `conf ≥ 0.35`; an item appears in all matching feeds (feed-level `seen-set` dedupes).

**Stage 2 — Vision/LLM (runs only when needed):**

- Trigger: `conf_lex < 0.5` for every category (≈15% of items in practice).
- Method (MVP): `gpt-4o-mini` vision, **low detail**, 3 sampled frames (t≈10%, 50%, 90%) + caption → returns `{categories: [{slug, confidence}], nsfw: bool, language: string, quality_note}`. Cost ≈ **$0.0004/video** (§A.2).
- Method (scale): self-hosted **CLIP zero-shot** on a GPU worker; ≈ $0.001–0.002/video and no per-call variance; recommended when volume > ~50k videos/mo.

**Fusion & publish rule:**

| Condition | Action |
|---|---|
| `max conf ≥ 0.75` (lexical alone) | Publish to top category; multi-tag if others ≥ 0.5 |
| `0.5 ≤ max < 0.75` | Run Stage 2; publish if fused `max ≥ 0.6` |
| `0.35 ≤ max < 0.5` | Stage 2 → publish or `review_queue` if fused < 0.6 |
| `max < 0.35` | `review_queue` → staff assign or “Uncategorized” (hidden from users) |
| `nsfw = true` | Auto-hold → moderation queue (never published) |

**Moderation (mandatory for UGC policy):**

1. Auto-scan every item (lexical NSFW list + Stage-2 NSFW flag + open-source image NSFW model on thumbnails).
2. `approved` → publish; `flagged` → human review queue (target < 24h SLA); `rejected` → hidden + logged.
3. In-app **Report** flow → same queue with priority tag; takedown within 24h. DMCA → §7.3.

### 3.3 Pipeline & item state machine

```
ingested → classified → moderated → published
                      ↘ review_queue → (staff) → published | rejected | uncategorized
                      ↘ uncategorized (hidden; staff-only)  → assign | purge(30d)
deleted (creator revoke / DMCA / IG 404) → purge ≤ 24h
```

### 3.4 Edge cases (exact handling)

| Case | Handling |
|---|---|
| **Miscategorized** (conf < threshold) | → `review_queue`; visible to no user until assigned. Never pollute a feed with wrong-topic content. |
| **Overlapping interests** | Multi-tag top-3; item shows in all matching feeds; feed seen-set prevents repeats. |
| **Too-few results in a category** (< 20 live items) | Show adjacent categories (table above) + “Explore creators in {Category} →” card (§4.4.7). |
| **Creator leaves network** | Revoke/OAuth-expiry → mark media `revoked`; evict from feeds immediately; purge within 24h; viewer sees graceful “Creator left — content removed”. |
| **`video_url` missing (licensed audio)** | Item enters **card mode**: full-bleed thumbnail + caption + subtle “🎵 licensed audio” chip; tap opens still/motion (ken-burns) rather than video; no broken player. OR (config flag) filter to original-audio Reels only. Default: card mode. |
| **Duplicate reels** (same permalink/creator) | Upsert by `(creator_id, ig_media_id)`; no dup rows. |
| **IG media deleted / 404** | Sync marks `deleted`; purge ≤ 24h; evict from caches. |
| **Language mismatch** | Stage-2 language tag; user content-filter can hide non-selected languages (§4.4.6). |
| **Category saturation** | Feed prioritizes recency + creator diversity; clamp ≤ 3 consecutive items per creator. |

---

## 4. UX/UI Specification

### 4.1 Design language & tokens (dark-first, Gen-Z premium)

| Token | Value |
|---|---|
| Background | `#0B0B0F` (near-black, cool) |
| Surface | `#14141B` / `#1A1A24` |
| **Accent** | **Electric Violet `#7C5CFF`** (gradient partner `#A78BFF`) |
| Pop accents | Volt Lime `#C6FF3F` · Coral `#FF5C8A` |
| Text | `#F5F5FA` primary · `#9A9AA8` secondary |
| Semantic | Success `#3DD68C` · Warning `#FFB020` · Error `#FF5C5C` |
| Radius | 16dp cards · 24dp sheets · 999dp pills |
| Glass | backdrop blur + 40–60% translucency + 1px light top-edge border (“lit glass”) |
| Type | Inter; display tight letter-spacing (−2%); wordmark: uppercase, +0.12em, gradient text |
| Motion | springs everywhere (not tweens); stagger 24ms; 60fps |

Surfaces & depth toolkit: glass cards · animated **aurora/mesh gradients** (5–8s drift loop, GPU-cheap) behind onboarding/empty states · **film-grain** overlay on gradients (kills banding, adds tactility) · gradient CTAs with glow + springy press (scale 0.96 + ripple + haptic) · morphing state icons (like↔liked, follow↔following via crossfade) · glass pills (active = gradient fill + glow + bounce) · spring bottom sheets with drag grabber + backdrop dim/blur · animated sliders/toggles/segmented controls.

### 4.2 `freebuff-pro-ui` → Compose component mapping

> **Note on the paste slot:** the prompt's “paste your `freebuff-pro-ui` directory contents here” field arrived **empty**. Per the isolation mandate I did not open the `freebuff-pro-ui` directory; the mapping below is built from the component inventory visible in the workspace file tree (names only). `freebuff-pro-ui` is a React web kit — it is the **interactive design reference** for the native build, and the **V2 web player reuses it directly**. If the shipped inventory differs, re-resolve this table mechanically (it is 1:1).

| # | Need | `freebuff-pro-ui` reference | SCROLLECT Compose implementation | Used in |
|---|---|---|---|---|
| 1 | Glass card / CTA | `GlassCard`, `GlassButton`, `LiquidGlass` | Compose: translucent surface (40–60% alpha) + 1px top gradient border + glow shadow; press scale 0.96 + ripple | Everywhere |
| 2 | Aurora background | `AuroraBackground`, `MeshGradient` | Canvas multi-blob animated gradient (5–8s drift), 1 accent + 2 hues; `rememberInfiniteTransition` | Onboarding, empty states |
| 3 | Film grain | `GrainOverlay`, `NoiseTexture` | Low-alpha noise bitmap overlay + `Modifier.drawWithContent` | Gradient surfaces |
| 4 | Gradient CTA | `Button` | `Box` gradient bg + shadow glow + `animateFloatAsState` scale press | Splash, onboarding, CTAs |
| 5 | Pills / chips | `Tabs`, `Select` (patterns) | Custom glass `FilterChip`; active = gradient + glow + spring bounce (`spring(dampingRatio=0.5f)`) | Feed pills |
| 6 | Sheets | `Drawer`, `Modal` | M3 `ModalBottomSheet` + spring `SheetState`; drag grabber; dim + blur backdrop | Creator sheet, filters |
| 7 | Toggles/sliders | `Toggle`, `Slider`, `SliderRange`, `SwitchGroup` | M3 `Switch`/`Slider` with animated thumbs + live value; `SingleChoiceSegmentedButtonRow` for filter modes | Settings |
| 8 | Vertical pager + parallax | `useParallax` (motion hook) | Foundation **`VerticalPager`**; overlay parallax via `pagerState.currentPageOffsetFraction` | Home/category feed |
| 9 | Like burst | `FloatingParticles`, `Sparks` (3D), `useExplode` | Canvas particle burst + Lottie heart pop + `HapticFeedbackType.Confirm` | Double-tap like |
| 10 | Spring micro-interactions | `useSpring`, `usePulse`, `useFloat`, `useRotate`, `springConfigs`, `easings`, `presets/scale|hover|stagger` | Compose `spring(dampingRatio, stiffness)`; `InfiniteTransition` pulse/float; 24ms stagger via coroutine delays | Every tap |
| 11 | Skeleton loaders | `Skeleton` | Shimmer: infinite-transition gradient brush over layout-shaped cards (pattern §4.4.7) | All feeds |
| 12 | Empty states | (illustrated + Lottie pattern) | Lottie micro-animation + CTA (“Explore creators in Cars →”) | Per-category |
| 13 | Toast/snackbar | `Toast` | M3 `Snackbar` glass-styled, auto-dismiss, optional action | Like saved, errors |
| 14 | Search / command | `SpotlightSearch`, `CommandPalette` | V2: in-app filter/search sheet | V2 |
| 15 | Bottom nav | `TabBar`, `AnimatedSidebar`, `DockMenu` | M3 `NavigationBar` (Feed / Explore / Profile) | App shell |
| 16 | Creator grid | `MasonryGallery` | `LazyVerticalStaggeredGrid` of thumbnails | Creator profile |
| 17 | Settings layout | `BentoGrid`, `DashboardLayout`, `Accordion` | Accordion sections + toggles + sliders; reorderable interest chips | Settings |
| 18 | Interest picker grid | `BentoGrid`, `InteractiveHero` | `LazyVerticalGrid` of emoji+label cards; selected = gradient + spring scale + check | Onboarding step 2 |
| 19 | Hover/magnetic/3D | `HoverCard3D`, `MagneticUI`, `CursorTrail`, `CursorSpotlight`, 3D kit | N/A on touch → adapt as press-offset “magnetic” icons; 3D gated to splash on flagship GPUs, off by default | V2 web player only |
| 20 | Analytics charts | `Sparkline`, `BarChart`, `LineChart`, `GaugeChart`, `ProgressRing`, `DataTable` | V2 creator dashboard (web reuses kit directly; Compose mirrors) | V2 |
| 21 | AI chat | `ChatUI`, `MessageBubble`, `AISearchBar`, `TypingIndicator` | V2 “ask your feed” assistant / comments | V2 |
| 22 | Theme system | `themes/*` presets (`darkLuxury`, `glassmorphism`, `cyberpunk`, `linear`, `apple`), `useTheme` | Compose `ColorScheme` from §4.1 tokens; `dynamicDarkColorScheme`/`dynamicLightColorScheme` on Android 12+; light companion | Global |
| 23 | Wordmark/marquee | `MarqueeSection`, `LogoCloud` | Splash wordmark animation; V2 creator wall | Splash, V2 |
| 24 | Marketing sections | `TimelineSection`, `StatsSection`, `CTASection`, `FAQSection`, `TeamSection`, `FeaturesSection`, `HeroSection`, `AppleNavbar`, `FloatingToolbar`, `MacOSWindow` | V2 web marketing + creator landing page (reuse kit directly) | V2 |

### 4.3 Motion system spec

- **Springs (not tweens):** press `spring(damping=0.55f, stiffness=800f)`; sheet `spring(0.7f, 200f)`; pill bounce `spring(0.5f, 700f)`; page settle = pager default (velocity-aware fling).
- **Staggered entrances:** items fade+rise 24ms apart, max 400ms total; feeds and onboarding only (never on repeat scroll).
- **Haptics:** selection/swipe = `HapticFeedbackType.TextHandleMove` (subtle); like = `Confirm`; share/save = `LongPress`; passive scroll = none.
- **Reduce-motion:** honor system setting → disable parallax, particle bursts, aurora drift; use opacity-only transitions.
- **Perf budget:** all animations composable-driven on UI thread with `rememberInfiniteTransition`/`animate*`; video surface never recomposed during scroll (isolate player in `remember`/`key`).

### 4.4 Screen-by-screen spec

#### 4.4.1 Splash
- Full-bleed aurora (token §4.1) + grain; centered wordmark with gradient text reveal (typewriter tagline: “your feed. your rules.”) via `useTypewriter`-parity.
- min 1.2s, skip on tap; haptic on exit. Reduce-motion: fade only.
- Components: custom Canvas aurora; `Button` (glass CTA if not logged in); `Navigation` after auth check.

#### 4.4.2 Onboarding (3 steps, animated)
- **Step 1 — Welcome:** value prop + glass card + primary gradient CTA. Freebuff refs: `HeroSection`/`InteractiveHero` patterns, `GlassCard`.
- **Step 2 — Pick your vibe (multi-select grid):** 14 category cards (emoji + label) in a `LazyVerticalGrid`; select 3–8; selection = gradient fill + spring scale + check; live counter “3/8 selected”; **“Surprise me”** (🎲) auto-picks 4 randomly. Freebuff refs: `BentoGrid`, `InteractiveHero`, `presets/stagger` (24ms rise-in).
- **Step 3 — Refine:** notification toggle (V2) + “land in your first feed” CTA; progress dots animated.
- Post-onboarding: land directly in the first selected category feed with a 2s celebratory Lottie (“You found your vibe”).

#### 4.4.3 Home feed (edge-to-edge player + category pill row)
- **Layout:** full-bleed `VerticalPager` (foundation 1.7+); each page = one Reel; Media3 `ExoPlayer` per page with next-item preload (`addMediaItem` + `DefaultLoadControl`); `useController = false`.
- **Pill row:** horizontal glass pills (14 categories + “For you” at MVP = curated mix of selected categories). Active pill = gradient + glow + spring bounce; switching = pager scrolls to that feed's first item (shared-element crossfade).
- **Overlays (parallax on `currentPageOffsetFraction`):** top scrim (status-bar safe), bottom gradient scrim; **glass caption card** (creator handle + caption + #hashtags, 1px lit top edge) that slides up on pause; right rail: like · comment (V2) · save · share-to-IG (V2) · report; left: creator avatar + follow (morphing).
- **Interactions:** double-tap = like burst (particles + Lottie heart + `Confirm` haptic); single tap = pause/play (morphing icon); long-press = scrub preview (V2); swipe down on caption card = open **creator sheet** (`ModalBottomSheet`, spring); swipe right (optional) = next category.
- **Card mode** for licensed-audio items (§3.4): ken-burns motion on thumbnail + caption + “🎵 licensed audio” chip; same interactions minus scrubbing.
- **States:** skeleton shimmer on first load; offline banner (glass, cached captions remain); error card with retry.

#### 4.4.4 Category feed
- Same player component; pill row drives which category's queue the pager shows; shared-element transition from creator profile and between categories.
- Empty category → §4.4.7 empty state (adjacent categories + creator discovery CTA).

#### 4.4.5 Creator profile
- Header: avatar, handle, follower count (approx, cached), bio, follow/following morphing button; back = shared-element to feed.
- Body: `LazyVerticalStaggeredGrid` of their live Reels (tap → pager); “Creator is offline” banner if revoked.
- Freebuff refs: `MasonryGallery`, `GlassCard`, `TestimonialCard` (pattern for creator cards).

#### 4.4.6 Settings
- **Interests:** add/remove/reorder category chips live (drag handles; reorder persists via DataStore; feed updates immediately with “Saving…” toast → saved).
- **Content filters:** language multi-select; minimum quality toggle (hide card-mode/low-res); blocked creators; muted topics.
- **Notifications:** toggles (V2 push); frequency slider; quiet hours.
- **Data & privacy:** export my data; delete account (full flow, links to privacy policy + deletion); “revoked content” explanation.
- **Appearance:** dark/light/system; dynamic color on/off. About + legal.
- Freebuff refs: `Accordion`, `Toggle`, `SwitchGroup`, `Slider`, `SliderRange`, `Select`, `Tabs`, `AnimatedSidebar` (nav), `CommandPalette` (V2 search).

#### 4.4.7 Loading / empty / error / offline states
- **Skeleton:** shimmer cards mirroring final layout (video placeholder 9:16 + caption bar), `Skeleton`-parity pattern (§4.2 #11).
- **Empty:** Lottie illustration + headline “Nothing here yet” + primary CTA “Explore creators in {Category} →” + adjacent-category pills; background aurora.
- **Error:** friendly copy + retry button; never a blank screen.
- **Offline:** glass banner “You're offline — showing saved picks”; cached content only; actions disabled with explanation.

### 4.5 Accessibility & platform hygiene

- 48dp minimum touch targets (pills, rail icons); WCAG-AA contrast on all text (verify with Compose contrast checks); RTL layouts supported (contentDescription mirrored); safe-area insets + edge-to-edge with cutout handling (WindowInsets); TalkBack labels for every icon and gesture (double-tap-like announced); reduce-motion respected (§4.3); target SDK 35+, 64-bit only.

---

## 5. MVP vs V2 Scope

### 5.1 MVP (ship to validate the thesis)

| # | MVP item | Why it's essential (thesis link) |
|---|---|---|
| 1 | Creator onboarding (Instagram Login OAuth) | Proves **creator willingness** — the network's supply side. Without it there is no content. |
| 2 | Ingestion worker (incremental sync + media pipeline) | Supplies the feed from authorized sources only; enforces rate limits; proves operational viability. |
| 3 | Keyword + hashtag classifier (lexical) + moderation queue | Enables **interest-filtered discovery** (the core value) and satisfies Play's UGC moderation requirement. |
| 4 | One feed + category pill row | The core UX: category-locked browsing. Activation metric. |
| 5 | One onboarding flow (pick 3–8 + surprise me) | Measures **interest-signal quality** and onboarding completion; drives everything downstream. |
| 6 | Like / save | Cheap **retention signal**; feedback loop for ranking. |
| 7 | Settings (interests, filters, privacy basics) | Users must be able to refine/quit — trust + control; required by Play data-safety expectations. |
| 8 | Compliance pack (review notes, privacy policy, moderation) | Play submission blocker; also legal credibility with creators. |

### 5.2 V2 (post-validation)

| V2 item | Notes |
|---|---|
| CV tagging (CLIP self-host) | Scale cost-efficiently past ~50k videos/mo (§A.2) |
| Comments + messaging | `instagram_manage_comments` scope + webhooks |
| Push notifications | `POST_NOTIFICATIONS`; quiet hours |
| Creator payouts + analytics dashboard | Charts from `freebuff-pro-ui` (§4.2 #20) |
| Light mode + dynamic color polish | Scheme already tokenized |
| Tablet / iPad layout + web player | Web player reuses `freebuff-pro-ui` components directly |
| Share-to-IG (publish back) | `instagram_business_content_publish` scope |
| “Ask your feed” AI assistant | `ChatUI`-parity, V2 |

---

## 6. Development Timeline & Blockers

### 6.1 Gantt-style plan (12 weeks; platform + Android streams parallelize)

| Sprint | Wk | Stream A — Platform (backend) | Stream B — Android | Milestone |
|---|---|---|---|---|
| S0 | 1 | Meta app setup; Business Verification filing; repo/CI; seed-creator list | Android skeleton; theming; CI; navigation shell | 10 seed creators signed |
| S1 | 1.5–2 | OAuth + token vault + sync worker v1 + webhook receiver | Splash + onboarding Step 1–2 | Creator onboarding end-to-end (green) |
| S2 | 3–4 | DB schema; ingestion; media proxy; signed URLs; caching policy | Onboarding complete + surprise-me; first feed (dev mock) | First 100 real Reels ingested |
| S3 | 5–6 | Classifier v1 (lexical) + moderation queue + feed API v1 | Home feed: `VerticalPager` + Media3 + card mode | Feed serves categorized real content |
| S4 | 7–8 | Feed v2 (pills, related, seen-sets); rate-limit guardrails; analytics | Pills, like/save bursts, creator sheet, skeleton/empty/error states | Core loop complete |
| S5 | 9–10 | Hardening: webhooks, quota dashboards, compliance pack, monitoring | Creator profile, settings, perf, a11y, reduce-motion | Beta (closed Play test) |
| S6 | 11–12 | Launch runbook; seed-creator onboarding support | Release build; Play listing; review buffer | Internal launch + Play submission |

*Allocations match target: API integration 1.5 wks · backend+DB+ingestion 2–3 wks · classifier 1–2 wks · Android UI 3–4 wks · Play buffer 1 wk.*

### 6.2 Top risks & mitigations (quantified)

| Risk | Likelihood | Impact | Mitigation | Cost guardrail |
|---|---|---|---|---|
| **Creator cold-start** (empty feeds kill retention) | High | Critical | Launch with 10–20 **seed creators** (direct invites + $50–100 onboarding credit each ≈ **$500–2,000**); creator landing page; per-category coverage checks | Cap seed spend $2k; track signup→publish conversion |
| **Streaming cost blow-up** | High at scale | Financial | Adaptive bitrate (480p floor), device cache (LRU 512MB ≈ −20–30% repeat views), signed URLs, per-user quality cap; alert at $500/mo. Model: **$0.001/min delivered** (Mux 1080p; §A.1) → 500 MAU ≈ $125/mo; 5k MAU ≈ $2.1k/mo before optimizations | Budget alerts; per-MAU target < $0.45/mo |
| **`video_url` gaps** (licensed audio) | Certain (est. 30–60% of Reels) | Medium | Card mode (§3.4) + optional original-audio-only filter; measure gap % in S3 and decide | None (design handles it) |
| **Play Store rejection** | Medium | Critical | Compliance pack (review notes + privacy + moderation SLA 24h + report flow); pre-submission checklist (§7.1); counsel review | Legal review $500–1,500 (one-time) |
| **Creator churn** | Medium | High | 24h revocation purge (trust), creator dashboard (V2), payouts (V2), direct feedback loop | Retention metric: creators publishing > 30d |
| **Rate limits** | Certain | Medium | §2.4 budget + backoff + webhooks; never poll faster than 30-min steady state | Quota alerts at 80% |

### 6.3 Validate BEFORE engineering starts

1. **Creator interest:** 20–30 real creators (from seed list) — “would you authorize Instagram Login for a discovery network?” (target ≥ 70% yes).
2. **OAuth willingness:** 5 creators complete a 10-min OAuth prototype; measure drop-off. (Business Verification lead time is external — file it Day 1.)
3. **Streaming budget:** founder sign-off on §A.1 cost model for 500 → 5k MAU.
4. **Name + category taxonomy** (§8-1, §8-2).

---

## 7. Google Play Store & Compliance

### 7.1 Submission checklist

1. ✅ Google Play developer account ($25, one-time).
2. ✅ App signed (Play App Signing); 64-bit AAB; target SDK 35+; min SDK 26 (Android 8.0 — coverage + WebView-safe).
3. ✅ **Content rating questionnaire → Teen+** (short-form UGC video, no explicit content policy; auto-moderated).
4. ✅ **Data safety form** (§7.2).
5. ✅ **Privacy policy URL** (public; `docs/privacy-policy-draft.md` → hosted at `https://scrollect.app/privacy`).
6. ✅ **Permissions rationale** — only: `INTERNET` (network), `ACCESS_NETWORK_STATE` (offline detection), `POST_NOTIFICATIONS` (V2, runtime-granted). No other permissions. Haptics need none.
7. ✅ **Meta compliance disclosure** in review notes: paste §2.6 verbatim + explain Instagram Graph API usage (permission `instagram_business_basic`, opt-in only, no scraping).
8. ✅ UGC moderation described (auto-scan + review queue + report + 24h takedown + DMCA process).
9. ✅ App category: Entertainment/Video Players; “In-app purchases: none”; “Ads: none”; “Personal info: email (accounts), video content (creators), user IDs”.
10. ✅ Screenshots + promo video + store copy (Gen-Z tone); data-deletion instructions linked.

### 7.2 Data safety form (draft answers)

| Collected data | Type | Shared | Purpose |
|---|---|---|---|
| Email (viewer accounts) | Personal | No | Account/auth |
| Creator Instagram handle + IG user ID | Personal | No | Attribution + revocation |
| Authorized Reel metadata + video (creator only) | User-generated content | Yes (to video CDN processor) | Core feature; stored with authorization |
| Device analytics (crash, usage) | App activity | No | Stability/quality |
| Approx. location | Not collected | — | — |

*Delete flow:* in-app “Delete account” → 30-day grace → full erasure; creator revocation → 24h media purge; both documented in policy.

### 7.3 Policies that could reject this app → mitigations

| Policy risk | Why it bites | Mitigation |
|---|---|---|
| **Deceptive behavior** | Claims of “full Instagram feed” would be false | Marketing says “creator network”; feed is exactly what's delivered |
| **UGC moderation** | Unmoderated user content | Auto-scan + human queue + report + 24h takedown SLA + appeal path |
| **Copyright / IP infringement** | Reposting creator content | Content stays creator-owned; ingestion only with opt-in; **creator revocation 24h**; DMCA agent + takedown process; note: card-mode items avoid re-hosting licensed audio |
| **API policy compliance** | Misusing Meta APIs | §2.6 statement; only official endpoints; no scraping; disclose in review notes |
| **Data safety mismatch** | Under-declared collection | §7.2 table mirrors policy exactly |
| **Minimum functionality** | Thin apps rejected | Core loop (onboarding→feed→like/save→settings) fully functional at submission |
| **SDK impersonation** | Mimicking Instagram branding | Distinct name/logo; no IG trademark in brand or icon |

### 7.4 Privacy policy

Full draft ready for counsel review in **`docs/privacy-policy-draft.md`** (sections: overview · collection · use · legal bases · storage/security · sharing · retention · creator revocation · user rights · children · contact). Summary of the four blocks reviewers check: (1) what we collect and why; (2) retention & deletion mechanics (24h purge, 30-day account erasure); (3) creator authorization & revocation; (4) no data sale + processor list.

---

## 8. Decisions Needed Before Day 1

| # | Decision | Options | Owner | Due |
|---|---|---|---|---|
| 1 | **App name** | SCROLLECT / TUNED / SPLICE / CURIO (§0) + trademark check | Founder | S0 |
| 2 | **Category taxonomy** | 14 listed (§3.1) vs expanded set | Product | S0 |
| 3 | **Video vendor** | Mux (verified: $0.003/min storage, $0.001/min delivery, 100k free) vs Cloudflare Stream ($5/1k min stored, $1/1k min delivered) vs Bunny (cheaper egress) | Founder+Eng | S0 |
| 4 | **Backend deploy** | Fly.io vs Railway vs Render | Eng | S0 |
| 5 | **Classifier MVP** | gpt-4o-mini vision API vs self-hosted CLIP | Eng | S0 |
| 6 | **Licensed-audio policy** | Card mode (default) vs original-audio-only | Product | S3 |
| 7 | **Seed creator budget** | $500–2,000; list of 10–20 creators | Founder | S0 |
| 8 | **Accent identity** | Electric Violet `#7C5CFF` (+ Volt Lime / Coral) vs alternatives | Design | S0 |
| 9 | **Beta cohort** | 50–100 users; feedback channel | Product | S5 |
| 10 | **Legal review** | Counsel sign-off on privacy policy + DMCA | Founder | S5 |

---

## Appendix A — Quantified cost model (spreadsheet-ready)

### A.1 Video pipeline (prices verified from vendor pages, Aug 2026)

| Vendor | Storage | Delivery | Notes |
|---|---|---|---|
| **Mux Video** | $0.003/min-mo (1080p; 720p $0.0024) | **$0.001/min** (1080p; 720p $0.0008) — **first 100k min/mo free** | Input free (Basic); $20/mo credit plan; cold storage −60%; moderation $0.001/sample |
| **Cloudflare Stream** | **$5 / 1k min-mo** | **$1 / 1k min** ($0.001/min) | Free tier includes an allowance (check dashboard); HLS/DASH; global network |

**Worked example — MVP (soft launch: 200 creators · 6,000 Reels · avg 45s · 500 MAU @ 15 min/day):**

```
Storage   = 6,000 × 0.75 min              = 4,500 min
Mux       = 4,500 × $0.003                = $13.50/mo
Stream    = 4.5 × $5.00                   = $22.50/mo

Delivery  = 500 × 15 min × 30             = 225,000 min/mo
Mux       = max(0, 225k − 100k) × $0.001  = $125/mo
Stream    = 225 × $1.00                   = $225/mo
```

**Phase 2 (5,000 MAU):** delivery = 2.25M min/mo → Mux ≈ $2,150/mo · Stream ≈ $2,250/mo. Mitigations (bitrate ladder floor 480p, device LRU cache −20–30% repeat views, per-user quality cap) target **< $0.45 per MAU/month**.

### A.2 Classification

| Method | Per-video cost | Formula | Notes |
|---|---|---|---|
| Lexical (Stage 1) | $0.00 | CPU + lexicon | Runs on 100% of items |
| `gpt-4o-mini` vision (Stage 2, ~15% of items) | ≈ **$0.0004** | ~1.2k tokens (3 low-detail frames ≈ 255 + caption ≈ 400 + system 300 + output 250) × $0.15/1M in + $0.60/1M out | 6,000 videos/mo ≈ **$2.40/mo**; 100k/mo ≈ $40/mo |
| Self-hosted CLIP (scale) | ≈ $0.001–0.002 | GPU ~$0.70/hr; ~500 videos/hr/GPU | Switch when > ~50k videos/mo |

### A.3 Infra & services (MVP totals)

| Item | Choice | Monthly (MVP) |
|---|---|---|
| Postgres | Neon free tier (0.5 GB, ~190 compute hrs) → scale tier | $0 → $19 |
| Redis/queue | Upstash free tier → paid | $0 → $10 |
| Object storage | Cloudflare R2 ($0.015/GB-mo, egress free) — 6,000 × 30 MB ≈ 180 GB | ~$2.70 |
| API + worker hosting | Fly.io/Railway (2 small instances) | $10–30 |
| Observability | Sentry free → paid | $0 → $26 |
| Meta Business Verification | Free (external, 1–2 wks) | $0 |
| **Total infra** | — | **≈ $30–90/mo** |
| **Video delivery @ 500 MAU** | Mux | **≈ $140/mo** |
| **Grand total (MVP, 500 MAU)** | — | **≈ $170–230/mo** |

*All figures are formulas, not hand-waves: `storage = videos × avg_min`, `delivery = MAU × min_per_day × 30 × price_per_min`. Recompute at each scale checkpoint (500 / 5k / 20k MAU) with the owner in §8-3.*

## Appendix B — Glossary

| Term | Meaning |
|---|---|
| Opt-in creator network | App content comes only from creators who authenticated and authorized distribution |
| Advanced Access | Post-App-Review state that lets a permission be used for real (non-admin) users |
| Long-lived token | 60-day Instagram user access token (exchanged from the 1-hour token) |
| Card mode | Fallback presentation for Reels whose `video_url` is absent (licensed audio) |
| `since`-sync | Incremental fetch using the `since` timestamp param to only pull new media |
| Review queue | Human-moderation bucket for flagged/low-confidence items; never user-visible until approved |


