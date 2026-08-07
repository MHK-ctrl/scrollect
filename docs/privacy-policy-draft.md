# SCROLLECT — Privacy Policy Draft

**Status:** Draft v0.9 for counsel review — *not legal advice*. Review before publishing to the Play Store, the app dashboard, and Meta app review. **Live at `https://scrollect-privacy.vercel.app`** and linked from the Play listing + in-app Settings. *Scope-name note: `instagram_business_basic` is the current name of the permission formerly called `instagram_basic`; the App Review filing should request `instagram_business_basic`.*

---

## 1. Overview

SCROLLECT ("we", "our", "the app") is an opt-in creator discovery network: a mobile app where you watch short-form videos ("Reels") contributed by creators who have chosen to share their own content through SCROLLECT. This policy explains what we collect, why, how we protect it, and how you can control it. We do **not** sell personal data and we do **not** scrape or collect data from Instagram without the content owner's explicit authorization.

## 2. What we collect

**From viewers (you):**
- Account email and display name, if you create a SCROLLECT account.
- Anonymous usage analytics (sessions, crashes, feature use) used only for stability and product quality.
- Your chosen interest categories and in-app preferences (likes, saves, filters).

**From creators (you):**
- Your Instagram handle and Instagram user ID, collected only when you authenticate through Instagram Login.
- The Reels and associated metadata (caption, hashtags, thumbnail, statistics) that **you** authorize us to ingest via the official Instagram Graph API scope `instagram_business_basic`.
- Your authorization state (whether you have connected, and whether you have revoked).

We do **not** collect: precise location, contacts, SMS, call logs, device identifiers beyond standard crash/analytics identifiers, or any content from accounts that have not authorized us.

## 3. How we use data

- To operate the app: show your interest-filtered feed, power likes/saves, and manage creator accounts.
- To classify and moderate content: automated keyword and (optionally) AI analysis of creator-authorized media to assign category tags and detect prohibited content.
- To communicate: essential service notices (e.g., "your Instagram connection is expiring").
- To comply with law and to protect rights, including responding to takedown or DMCA requests.

## 4. Legal bases (EU/UK users)

We process personal data under the GDPR bases of consent (where you opt in, e.g., creator authorization), contract (providing the service you signed up for), legitimate interests (security, abuse prevention, product improvement), and legal obligation.

## 5. Storage & security

- Data is stored on encrypted infrastructure (database at rest encryption; tokens AES-256-GCM encrypted; TLS in transit).
- Creator access tokens are stored **server-side only**, never on your device.
- Access is limited to staff on a need-to-know basis; access is logged.

## 6. Sharing & processors

We do not sell or rent personal data. We share only with processors who act on our instructions and contractually protect your data:
- Hosting & database providers (e.g., our backend host and PostgreSQL provider).
- Video streaming/CDN providers (we transmit creator-authorized videos to them for playback).
- AI classification providers (creator-authorized media may be processed for tagging/moderation).
- Analytics/crash reporting providers (anonymized metrics).
- Meta Platforms, Inc. — as the source platform from which creators authorize content via Instagram Login; we share nothing with Meta beyond the API calls made on the creator's own behalf.

## 7. Retention

- Feed metadata and thumbnails: cached for up to 24 hours and refreshed on demand.
- Creator content: retained for as long as the creator remains authorized and the content is valid, plus a short operational grace period.
- Account data: retained while your account is active; deleted within **30 days** of account deletion.
- Creator revocation: when a creator revokes access or leaves the network, their content is removed from the app within **24 hours**.

## 8. Creator authorization & revocation

Your Reels remain **your** content. We store and display them only because you authorized us through Instagram Login. You can revoke at any time by (a) disconnecting in SCROLLECT Settings, or (b) revoking the app inside Instagram's settings. On revocation we remove your content within 24 hours.

## 9. Your rights

Subject to applicable law, you may request: access, correction, portability, restriction, and deletion of your personal data; and you may withdraw consent or object to processing. To exercise rights: email `mdhamzakhan2k6@gmail.com` (we respond within 30 days). California residents have CCPA/CPRA rights including "do not sell/sharing" (we do not sell). Where automated classification materially affects you, you may request human review.

## 10. Children

SCROLLECT is not directed at children under 13 (16 in the EEA/UK). We do not knowingly collect their data. If you believe a child has provided data, contact us for deletion.

## 11. Changes & contact

We may update this policy and will post changes here. Material changes will be notified in-app. Contact: `mdhamzakhan2k6@gmail.com`. Data controller: SCROLLECT (legal entity TBD — assign before publishing).

---

**Counsel review checklist:** confirm (1) controller entity & jurisdiction; (2) DPA with video CDN + AI processor; (3) cookie/analytics notices for the V2 web player; (4) DMCA agent designation for U.S. safe harbor; (5) country-specific disclosures (Brazil LGPD, etc.) before global launch.
