# SCROLLECT — Meta Dashboard Runbook (tap-by-tap)

**Who:** the founder, working from a phone (use desktop-site mode) — or a desktop.
**When:** now. This is the manual part of the Meta submission track; CI and code
are already done. Do the three tasks below **in order** — the redirect URI
unblocks the OAuth flow, App Review is the long pole (1–3+ weeks), and Business
Verification (~1–2 weeks) runs in parallel.

**Your app state (verified):**

| Item | Value / status |
|---|---|
| App ID | `1820302022684933` |
| App name | Scrollect |
| Use case | **"Manage messaging and content on Instagram"** (correct choice) |
| Current screen | **"API setup with Instagram login"** — this is the right path, do not switch products |
| Privacy policy URL | ✅ saved: `https://scrollect-privacy.vercel.app` |
| Valid OAuth Redirect URI | ❌ not saved yet → **Task 1** |
| App Review | ❌ not submitted → **Task 2** |
| Business Verification | ❌ not started → **Task 3** |
| Webhooks | ⛔ **DO NOT touch.** Do not configure webhooks until the app is published (post-approval) |

**One rule for all three tasks:** request/set ONLY `instagram_business_basic`.
Do not request messaging, ads, hashtag, or any other permission.

---

## Task 1 — Save the Valid OAuth Redirect URI (5 minutes)

Without this, creator login returns a redirect error the moment we go live.

1. Open `developers.facebook.com/apps` → tap the **Scrollect** app card.
2. Left menu: **Use cases** (a puzzle-piece icon, under the app name).
3. Tap **Customize** on the **"Manage messaging and content on Instagram"** card
   (or tap **"API setup with Instagram login"** directly).
4. On the **API setup with Instagram login** screen, scroll to the section titled
   **Valid OAuth Redirect URIs** (below the Client OAuth toggle; **skip** any
   Webhooks section that appears above it).
5. Tap the **Add a Redirect URI** text box and paste **exactly**:
   ```
   https://api.scrollect.app/api/v1/auth/ig/callback
   ```
   - No trailing slash, no spaces, HTTPS. It must match the backend's
     `INSTAGRAM_REDIRECT_URI` **character-for-character** — a mismatch = 404 on
     login (the `/api/v1` path segment matters; the backend route is
     `POST /api/v1/auth/ig/callback`).
6. Make sure **Client OAuth** and **Web OAuth Login** toggles are **On**.
7. Tap **Save** (top-right or bottom of the card).

**What you should see:** the URI appears as a saved row in the list. The app
dashboard may show a yellow "in development" banner — that's normal.

**If the field isn't visible (fallback paths):**
- Try **Instagram → API Setup** in the left menu, or
- **App settings → Advanced → Valid OAuth Redirect URIs** (bottom of the page),
  or
- Use the same **Advanced** page's **Valid OAuth domains** field for the
  `api.scrollect.app` domain.

---

## Task 2 — App Review: request Advanced Access for `instagram_business_basic` (30 minutes)

This is the submission that unblocks real users. Read the answers through once,
then copy-paste. Everything below matches `docs/privacy-policy-draft.md`
(24h cache, 30-day deletion, no sale, no scraping) and the actual app behavior —
**do not improvise new claims.**

1. Left menu: **App Review → Permissions and Features**.
2. Find the permission **`instagram_business_basic`** (the current name of the
   permission formerly called `instagram_basic` — **this** is the one to
   request).
3. Tap **Request Advanced Access**.
4. Fill the form field-by-field:

   **a. Use-case description** (paste):
   > SCROLLECT is an opt-in creator discovery network. Creators authorize their
   > own Instagram Reels through official Instagram Login; the app ingests only
   > the authorizing creator's own media via the official Instagram Graph API
   > and shows it in interest-filtered feeds to end users. SCROLLECT never
   > accesses, reads, or filters any user's personal Instagram feed or
   > recommendations, and never reads private accounts.

   **b. Data use explanation** (paste):
   > We collect only what the creator authorizes: their Instagram handle and
   > user ID, their own Reels metadata (caption, hashtags, thumbnail,
   > statistics) and the video itself, plus an encrypted access token stored
   > server-side (AES-256-GCM). Feed metadata and thumbnails are cached for up
   > to 24 hours and refreshed on demand. If a creator revokes access or
   > disconnects, their content is removed from the app within 24 hours;
   > account data is deleted within 30 days of account deletion. We never sell,
   > rent, or share personal data; video bytes are transmitted only to our
   > streaming/CDN processor for playback. Full details in our privacy policy:
   > https://scrollect-privacy.vercel.app

   **c. Anti-scraping compliance statement** (paste — verbatim from
   `docs/play-store-review-notes.md` §1):
   > SCROLLECT is an opt-in creator discovery network. It does not scrape,
   > crawl, or collect data from Instagram without explicit authorization, and
   > it never will. Every video in the SCROLLECT feed is published by a creator
   > who has (a) authenticated with their own Instagram account through the
   > official Instagram Login, (b) granted access via the official Instagram
   > Graph API scope `instagram_business_basic`, and (c) affirmatively opted in
   > to distribution through SCROLLECT. Content is accessed exclusively through
   > Meta's official, documented APIs in compliance with the Instagram Platform
   > Policies. Creators may revoke access at any time, and SCROLLECT removes
   > their content within 24 hours of revocation.

   **d. Demo / screencast instructions** (paste):
   > Live Meta access is not yet enabled, so the demo uses the app's offline
   > mock build, which runs the identical onboarding → feed → settings flow with
   > seeded creator content. Walkthrough video: Splash → Onboarding (pick
   > interests) → feed with category pills → Settings → disconnect/revoke flow.
   > Two Instagram test accounts (Business/Creator type) will be provided for
   > review once the live pipeline is enabled.

   **e. Privacy policy URL:** `https://scrollect-privacy.vercel.app`
   (already saved in the dashboard — confirm it still shows).

   **f. Attach the screencast** — ~60 seconds, record from an Android emulator
   running the **mock** build, in this order:
   - 0–5s: Splash (SCROLLECT wordmark) → Onboarding welcome.
   - 5–20s: Onboarding "Pick your vibe" — select 3–4 interests.
   - 20–45s: Feed — a Reel plays full-screen; tap the category pills to switch;
     double-tap to like; swipe down to the creator profile.
   - 45–60s: Settings — interests, data & privacy; show the disconnect/revoke
     option and the "content removed within 24h" explanation.
   - No audio needed; on-screen captions optional.

5. **Submit.** You must request Advanced Access for `instagram_business_basic`
   **only** — do not add `instagram_manage_comments`, ads, or hashtag
   permissions. (V2 share-back would add
   `instagram_business_content_publish` later — not now.)

**What you should see:** the permission row shows **In Review**. The status
timeline (typically 1–3+ weeks):
- **In Review** — Meta's team is looking at it. No action needed.
- **Changes Requested** — read the message in the same screen, answer in-line
  with the exact text you pasted above (adjust only what they specifically
  flagged), and resubmit. Common asks: clearer use case, screencast that shows
  the OAuth consent screen, or a second test account — all covered above.
- **Approved** — Advanced Access is granted. Proceed to `docs/LIVE-FLIP.md`.

---

## Task 3 — Business Verification (desktop-only, 30 minutes + 1–2 week wait)

Required for Advanced Access (announced Feb 1, 2023; enforced for new apps).
**Do this on a desktop browser** — the flow needs file uploads and a webcam-free
camera step on a computer.

1. Open `business.facebook.com` → **Settings** (gear icon) → **Security Center**.
2. If prompted, **create a Business Portfolio** (free, ~2 minutes): name it
   "Scrollect", choose the business category, skip adding payment methods.
3. In Security Center → **Business Verification** → **Start Verification**.
4. Choose the **individual** route and provide a **government-issued ID**
   (passport or driver's license). Complete the on-screen identity match
   (name + document). An **individual** verification is the right track for a
   solo founder; a company track needs registration documents.
5. Submit and note the confirmation.

**What you should see:** a "verification in progress" state in Security Center.
Typical timeline **1–2 weeks**; you may be asked for a follow-up document if the
ID photo is unclear (resubmit immediately — the clock pauses).

**Tip:** the moment verification is **approved**, add the privacy policy URL
(already saved) and data-deletion instructions to the app dashboard → **App
settings → Advanced** if Meta asks for them again before going live.

---

## After all three

1. Redirect URI saved → live OAuth will work once credentials are set.
2. App Review **Approved** → Advanced Access for `instagram_business_basic`.
3. Business Verification **approved** → Advanced Access unlocks.

Then execute `docs/LIVE-FLIP.md` top-to-bottom: env vars → Android live flavor →
Meta sandbox exercise with 2 test accounts → webhooks (post-publication) → ship.
