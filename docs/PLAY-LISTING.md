# SCROLLECT — Google Play Listing Package

**Purpose:** copy-paste-ready Play Console submission material. Every data claim
mirrors `docs/privacy-policy-draft.md` line-for-line (24h cache, 30-day deletion,
no scraping, processor list) and `docs/play-store-review-notes.md`. Do not reword
the compliance statements.

**Companions:** `docs/privacy-policy-draft.md` (must be live at
`https://scrollect-privacy.vercel.app`) · `docs/play-store-review-notes.md` ·
`docs/LIVE-FLIP.md` (post-approval runbook) · `docs/CDN-DECISION.md`.

---

## 1. Store copy### App title (≤ 30 characters)

```
Scrollect — Videos, Your Rules
```
*(30 chars — includes brand + short tagline. Avoid "Reels" in the title: it's an
 Instagram trademark, and `play-store-review-notes.md` §5 requires "No Instagram
 trademark in the app name/icon; distinct branding". The word "Reels" may still
 appear in the description to describe content format.)*

### Short description (≤ 80 characters)

```
Reels from opted-in creators, filtered by your interests. No noise feed.
```
*(72 chars.)*

### Full description (formatted for Play — plain text, newlines ok)

```
Your feed. Your rules.

SCROLLECT is an interest-locked video discovery app. Pick 3–8 interests at
onboarding and watch only Reels that match them — every video comes from a
creator who explicitly chose to share their own content through SCROLLECT via
the official Instagram Login. No noise feed. No algorithm chaos. Your rules.

WHAT MAKES SCROLLECT DIFFERENT
• Opt-in creator network — content only from creators who authorized it
• Interest-locked feeds — 14 categories, tuned to your vibe
• Card mode — licensed-audio Reels still play, smartly
• Like, save, and explore creators — your picks, your pace
• Privacy-first — no scraping, no personal-feed access, ever

PRIVACY & COMPLIANCE
SCROLLECT is an opt-in creator discovery network. It does not scrape, crawl, or
collect data from Instagram without explicit authorization, and it never will.
Every video in the SCROLLECT feed is published by a creator who has (a)
authenticated with their own Instagram account through the official Instagram
Login, (b) granted access via the official Instagram Graph API scope
instagram_basic, and (c) affirmatively opted in to distribution through
SCROLLECT. Content is accessed exclusively through Meta's official, documented
APIs in compliance with the Instagram Platform Policies. Creators may revoke
access at any time, and SCROLLECT removes their content within 24 hours of
revocation.

Privacy policy: https://scrollect-privacy.vercel.app
```

> **Keywords for the description:** reels, short video, vertical video, curated
> feed, interests, discover, creators, no noise feed, category feed.

---

## 2. Assets spec

| Asset | Required size/format | Spec |
|---|---|---|
| **App icon** | 512 × 512 px, 32-bit PNG | Existing adaptive icon (foreground on `#0B0B0F` background). Keep the top-left/bottom-right safe zones clear; no Instagram trademark. |
| **Feature graphic** | 1024 × 500 px, JPG or 24-bit PNG (no alpha) | Dark background `#0B0B0F`, Electric Violet `#7C5CFF` gradient wordmark, tagline "your feed. your rules." Keep the text within the central safe zone — Play overlays a screen/stars on the bottom third and crops edges on devices. |
| **Phone screenshots** | 1080 × 1920 px (9:16) — 5 required | See wireframes below. Capture from the **mock flavor on an emulator** — never edit or composite mock data that isn't real app output. |

### Screenshot wireframes (capture order)

1. **Splash** — full-bleed aurora + wordmark "SCROLLECT" with tagline reveal.
2. **Onboarding — Pick your vibe** — interest grid (emoji + label cards), 3–8
   selected with gradient fill, live "3/8 selected" counter.
3. **Feed (home)** — full-bleed Reel with the **category pill row** at top
   (active pill highlighted), glass caption card, right rail (like/save/report).
4. **Creator profile** — avatar + handle header, follow button, staggered grid
   of their Reels.
5. **Settings** — interests / content filters / data & privacy sections.

### How to generate real screenshots

```bash
# 1. Build + install the offline mock flavor on an emulator (API 35):
cd android && ./gradlew :app:installMockDebug
# 2. Walk Splash → Onboarding (pick 3 interests) → Feed → Creator sheet → Settings.
# 3. Capture each screen (while the emulator is focused):
adb exec-out screencap -p > screenshot-01-splash.png
adb exec-out screencap -p > screenshot-02-onboarding.png
adb exec-out screencap -p > screenshot-03-feed.png
adb exec-out screencap -p > screenshot-04-creator.png
adb exec-out screencap -p > screenshot-05-settings.png
```

Resize/crop to exactly 1080 × 1920 before upload. Screenshots must show the real
app — no wireframes, mockups, or borrowed footage in the listing.

---

## 3. Data Safety form mapping

Answers mirror `docs/privacy-policy-draft.md` §§2, 5, 6, 7 **exactly**. "Shared"
means shared outside the app with a third party; processor sharing is declared
per policy §6.

| Data type (Play Console) | Collected? | Shared? | Purpose (policy reference) |
|---|---|---|---|
| Email address (viewer accounts) | ✅ Yes | ❌ No | Account creation/auth (§2 "From viewers") |
| User IDs — Instagram handle + IG user ID (creators) | ✅ Yes | ❌ No | Attribution + revocation tracking (§2 "From creators", §8) |
| Photos or videos — creator-authorized Reels | ✅ Yes | ✅ Yes (video CDN processor) | Core feature; stored only with explicit authorization (§2, §6 "Video streaming/CDN providers") |
| App activity — Other user-generated content (captions, hashtags, thumbnails, stats) | ✅ Yes | ✅ Yes (AI classification/moderation providers) | Category feeds + classification/moderation (§2, §3, §6 "AI classification providers") — captions/thumbnails feed the moderation pipeline |
| App activity — App interactions (interests, likes, saves, filters) | ✅ Yes | ❌ No | In-app preferences/personalization (§2, §3) |
| App info and performance — Crash logs | ✅ Yes | ❌ No | Stability (§2 "Anonymous usage analytics") |
| App info and performance — Diagnostics | ✅ Yes | ❌ No | Product quality (§2) |
| Device or other IDs — Device or other IDs (crash/analytics identifiers only) | ✅ Yes | ❌ No | Crash/analytics correlation (§2) |
| Precise location | ❌ No | — | Explicitly not collected (§2 "We do not collect") |
| Approximate location | ❌ No | — | Explicitly not collected (§2) |

**Declared data uses in the form:** App functionality · Analytics · Developer
communications (essential service notices only).

> **Counsel check (before submitting):** confirm whether caption/thumbnail bytes
> sent to AI classification providers should also be declared under the CDN
> "shared" row — the policy (§6) names both processors; this table declares
> each data type at its most accurate granularity.

**Deletion paths (must match the policy):** in-app "Delete account" → 30-day
grace → full erasure (§7); creator revocation → content removed within 24 hours
(§7, §8). Link the privacy policy from the form's data-deletion section.

---

## 4. Content rating questionnaire (expected result: **Teen+**)

Run via Play Console → **Policy and programs → Content rating** → app category:
*Game? No — App*. Answer honestly; the answers below match the app's actual
content pipeline (all UGC is moderated — auto-scan + review queue + report +
24h takedown SLA).

| Question | Answer | Justification |
|---|---|---|
| Violence or bloodshed | None | Prohibited by the moderation pipeline; removed before publication |
| Sexually explicit content | None | Prohibited content auto-held + human review queue (never published) |
| Profanity or crude humor | None | Auto-scanned; flagged items require human approval |
| Mature/suggestive themes | None | Same moderation gate |
| Alcohol, tobacco, or drugs | None | Same moderation gate |
| Gambling | None | Not a feature |
| Real-money gambling | No | No gambling, betting, or casino mechanics |
| In-app purchases / real-money offers | No | No IAPs, ads, or purchases (MVP) |
| Sharing user location | No | Location is not collected at all (policy §2) |
| User-generated content | Yes — **moderated** | All videos are creator-authorized and pass an automated moderation pipeline (keyword + image screening + optional AI review) before appearing in any feed; users can report any item (24h takedown SLA) |
| User interaction (chat, comments) | No | No chat/messaging in MVP (V2 only) |
| Digital content (music/video playback) | Yes | Short-form video playback is the core function |
| Kid-directed | No | Designed for 13+; not directed at children (policy §10) |

**Expected result:** **Teen** — driven by moderated user-generated content; the
unmoderated-UGC outcome (Mature 17+) is avoided because moderation is mandatory,
documented, and demoable.

---

## 5. Target audience & ads

- **Target audience:** 13+ (teen). All content is creator-authorized and
  moderated; there is no child-directed content.
- **Ads:** **None.** Declare "This app contains no ads, no ad SDKs, and no
  third-party ad personalization" in the Ads section of the listing.
- **UGC moderation declaration** (paste into the user-generated content /
  review-notes fields — verbatim from `docs/play-store-review-notes.md` §4):

> All videos are creator-authorized and pass through an automated moderation
> pipeline (keyword + image screening + optional AI review) before appearing in
> any feed. Users can report any item; reports are triaged with a 24-hour
> takedown SLA. Prohibited content (explicit, violent, hateful, illegal) is
> removed and, where required, reported to the platform. Creators may revoke
> authorization at any time, after which their content is removed within 24
> hours.

---

## 6. Pre-submission checklist

- [ ] Privacy policy live at **https://scrollect-privacy.vercel.app** (dead URL = rejection)
- [ ] Support email in the policy (`mdhamzakhan2k6@gmail.com`) matches the dashboard
- [ ] Signed AAB (see `docs/LIVE-FLIP.md` Phase B — release signing + Play App Signing)
- [ ] Target SDK 35, 64-bit, versionCode/versionName from `gradle.properties` (currently 1 / 1.0.0)
- [ ] Screenshots captured from the real mock app (5 × 1080×1920) + feature graphic
- [ ] Data Safety form answers match this table and the policy
- [ ] Content rating completed → Teen
- [ ] No ads declared; UGC moderation statement pasted
- [ ] Meta compliance statement (play-store-review-notes §1) in review notes
