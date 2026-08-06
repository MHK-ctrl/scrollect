# SCROLLECT — Video CDN Decision Helper (Mux vs Cloudflare Stream)

**Purpose:** pick the MVP video pipeline vendor. Numbers come straight from
`SCROLLECT-SPEC.md` §A.1 (verified pricing, Aug 2026). No code ships until a
decision is made; integration must live behind a `MediaStorage` interface
(mirroring the `Db` interface pattern), with keys only in env.

---

## 1. Side-by-side

| Criterion | **Mux Video** | **Cloudflare Stream** |
|---|---|---|
| Storage price | **$0.003 / min-mo** (1080p; 720p $0.0024); cold storage −60% | **$5 / 1k min-mo** (= $0.005/min-mo) |
| Delivery price | **$0.001 / min** (1080p; 720p $0.0008); **first 100k min/mo free** | **$1 / 1k min** (= $0.001/min) |
| Encoding | Managed, on upload (input free on Basic; per-minute transcode billing) | On-demand transcoding; billed via storage minutes |
| Playback SDK fit with **Media3** | **First-party Android SDK built on ExoPlayer/Media3** — HLS playback, buffering tuning, built-in view analytics | **No native SDK** — play HLS/DASH through Media3 (`DefaultMediaSourceFactory` handles HLS out of the box); DIY analytics |
| Setup time | ~30 min: tokens (`MUX_TOKEN_ID`/`SECRET`), upload API, playback URL | ~1 h: account setup, Stream API, signed-token delivery, caching rules |
| Extras | Moderation $0.001/sample; $20/mo credit plan | Global network; token auth built in |
| Egress | Included in delivery price | Included in delivery price |

## 2. Worked costs at MVP volumes (spec §A.1: 4,500 min stored, 225,000 min/mo delivered)

```
Mux     = 4,500 × $0.003  (storage)   = $13.50
         + max(0, 225k − 100k) × $0.001 (delivery, first 100k free) = $125
         → ≈ $138.50/mo

Stream  = 4.5 × $5.00     (storage)   = $22.50
         + 225 × $1.00    (delivery)  = $225
         → ≈ $247.50/mo
```

**Phase 2 (5,000 MAU, 2.25M min/mo):** Mux ≈ $2,150/mo · Stream ≈ $2,250/mo —
they converge; Mux keeps the free-100k advantage only at launch volumes.

## 3. Recommendation

**Mux for the MVP.**

1. **Cheapest at launch** — the 100k free delivery minutes fully cover soft-launch
   traffic (~$138 vs ~$248/mo at spec §A.1 volumes).
2. **First-party Media3 SDK** — the Android client already uses Media3 ExoPlayer;
   Mux's Android player gives HLS playback + view analytics with less glue code
   than DIY HLS on Cloudflare.
3. **Same budget guardrails apply either way:** 480p floor, device LRU cache
   (Media3 `SimpleCache` −20–30% repeat views), signed URLs, per-user quality
   cap, alert at $500/mo (spec §6.2).

**Re-evaluate at ~5k MAU** (prices converge there) and at 20k+ MAU (consider
Bunny or self-hosted transcode + R2 origin per spec §A.3). This is decision §8-3
in the spec — owner: Founder+Eng.

## 4. Implementation guardrails (deferred, by design)

- **Interface first:** all pipeline access goes through a `MediaStorage`
  interface (upload → transcode → signed playback URL → purge-on-revoke), the
  same way `Db`/`CacheStore` are swapped by config, not code.
- **Keys stay in env:** `MUX_TOKEN_ID` / `MUX_TOKEN_SECRET` or
  `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_STREAM_TOKEN` — already documented in
  `scrollect/backend/.env.example`. Nothing committed.
- **24h content-cache rule applies to the CDN too:** purge-on-revoke within 24h,
  `Cache-Control: public, max-age=86400` on thumbnails, 15-min signed playback
  URLs (spec §2.5).
