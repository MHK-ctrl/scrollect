# SCROLLECT — Google Play Review Notes & Compliance Pack

**Purpose:** copy-paste-ready statements for the Google Play Console (app content declaration, data safety, review notes) and the Meta App Review submission. Keep in sync with `SCROLLECT-SPEC.md` §7 and `privacy-policy-draft.md`.

---

## 1. Meta compliance statement (verbatim — paste into Play review notes AND Meta app review)

> SCROLLECT is an opt-in creator discovery network. It does **not** scrape, crawl, or collect data from Instagram without explicit authorization, and it never will. Every video in the SCROLLECT feed is published by a creator who has (a) authenticated with their own Instagram account through the official Instagram Login, (b) granted access via the official Instagram Graph API scope `instagram_basic`, and (c) affirmatively opted in to distribution through SCROLLECT. Content is accessed exclusively through Meta's official, documented APIs in compliance with the Instagram Platform Policies. SCROLLECT never: collects personal feeds or recommendations; accesses private accounts; uses headless browsers, proxies, unofficial endpoints, or credential stuffing; bypasses or evades rate limits; or redistributes content without the creator's authorization. Creators may revoke access at any time, and SCROLLECT removes their content within 24 hours of revocation.

## 2. API disclosure (for Meta App Review — permissions requested)

| Permission | Purpose | Scope of use |
|---|---|---|
| `instagram_basic` | Read the **creator's own** media metadata (caption, hashtags, thumbnail, stats) after they opt in via Instagram Login, to power the SCROLLECT category feed | Only the authenticated user's own media; no feed aggregation, no third-party content |
| `instagram_content_publish` (V2 only) | Let creators optionally post a highlight back to their own Instagram | Requested only when the feature ships |

Provide in App Review: 2 test accounts + a screencast walking through: connect → consent screen → feed shows the creator's own Reels → revoke → content removed within 24h.

## 3. Play listing & data safety

- **App category:** Entertainment (video player / short-form discovery).
- **Content rating questionnaire:** complete honestly; expected outcome **Teen+** (UGC video with moderation; no explicit content policy).
- **Ads:** none. **In-app purchases:** none (MVP). **Real-money gambling:** no.
- **Permissions declared:** `INTERNET`, `ACCESS_NETWORK_STATE` (`POST_NOTIFICATIONS` added with the V2 push feature). No others.
- **Data safety form** (mirror `SCROLLECT-SPEC.md` §7.2): email (accounts), creator handle + IG ID (personal), creator-authorized videos/metadata (user-generated content, shared with video CDN processor), usage/crash analytics (not shared), no location.
- **Target audience:** 13+ (UGC policy applies — moderation mandatory).

## 4. UGC moderation description (paste into the "user-generated content" section)

> All videos are creator-authorized and pass through an automated moderation pipeline (keyword + image screening + optional AI review) before appearing in any feed. Users can report any item; reports are triaged with a 24-hour takedown SLA. Prohibited content (explicit, violent, hateful, illegal) is removed and, where required, reported to the platform. Creators may revoke authorization at any time, after which their content is removed within 24 hours.

## 5. Rejection-risk checklist (from `SCROLLECT-SPEC.md` §7.3)

- [ ] No deceptive claims — marketing says "creator network", not "the full Instagram feed".
- [ ] UGC moderation documented and demoable.
- [ ] Copyright posture: creator-owned content, opt-in storage, 24h revocation purge, DMCA process.
- [ ] Data safety form matches the privacy policy exactly.
- [ ] App is fully functional at submission (core loop end-to-end) — minimum functionality policy.
- [ ] No Instagram trademark in the app name/icon; distinct branding.
- [ ] Support email + privacy policy URL live before submission.

## 6. Submission checklist (from `SCROLLECT-SPEC.md` §7.1)

- [ ] Developer account ($25) · [ ] Signed AAB, 64-bit, target SDK 35+ · [ ] Content rating Teen+ · [ ] Data safety form · [ ] Privacy policy URL (`docs/privacy-policy-draft.md` → hosted) · [ ] Permission rationale · [ ] §1 verbatim statement in review notes · [ ] UGC moderation description · [ ] Screenshots + promo video · [ ] Store copy (Gen-Z tone) · [ ] Data-deletion instructions linked.
