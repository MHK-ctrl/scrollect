# SCROLLECT API contract (v1)

Single source of truth for the HTTP API shared by `backend/` and `android/`.
All responses use the error envelope below. Auth is `Authorization: Bearer <app JWT>`.

Instagram Login uses the scope `instagram_business_basic` — the current name of the permission formerly called `instagram_basic`; the App Review filing should request `instagram_business_basic`. The authoritative permission/scope list lives in `SCROLLECT-SPEC.md` §1.4 / §2.1.

## Error envelope (every endpoint)
```json
{ "error": { "code": "NOT_FOUND|VALIDATION_ERROR|UNAUTHORIZED|FORBIDDEN|PERSONAL_ACCOUNT|...", "message": "...", "requestId": "..." } }
```

## Endpoints

| Method | Path | Auth | Body / Query | Returns |
|---|---|---|---|---|
| GET | `/healthz` | – | – | `{status:"ok"\|"degraded", mockMode, checks:{db:"up"\|"down", redis:"up"\|"down"\|"skipped"}}` — 503 + `degraded` when a configured store is unreachable |
| POST | `/api/v1/auth/ig/start` | – | – | `{authorizeUrl}` (Instagram OAuth) |
| POST | `/api/v1/auth/ig/callback` | – | `{code, state}` | `{token, creator}` (live) |
| POST | `/api/v1/auth/mock/login` | MOCK only | `{handle}` | `{token, creator}` |
| POST | `/api/v1/auth/device` | – | `{deviceId}` | `{token, user:{id, interests}}` |
| GET | `/api/v1/auth/me` | Bearer | – | profile |
| GET | `/api/v1/categories` | – | – | `{categories:[{slug,label,emoji,adjacent,liveCount}]}` |
| GET | `/api/v1/feed` | optional | `categories=a,b&cursor&limit` | `{items:[FeedItem], nextCursor}` |
| PUT | `/api/v1/media/:id/like` | viewer | `{liked:bool}` (idempotent) | `{liked}` |
| PUT | `/api/v1/media/:id/save` | viewer | `{saved:bool}` (idempotent) | `{saved}` |
| GET | `/api/v1/creators/:id` | – | – | `{creator, media:[FeedItem]}` |
| POST | `/api/v1/creators/:id/revoke` | creator self | – | `{revoked, mediaRemovedImmediately}` |
| GET | `/api/v1/settings/interests` | viewer | – | `{interests}` |
| PUT | `/api/v1/settings/interests` | viewer | `{interests:[slug]}` (validated) | `{interests}` |
| GET | `/api/v1/moderation/queue` | creator | – | `{items}` |
| POST | `/api/v1/moderation/:id` | creator | `{action:"approve"|"reject"}` | `{status}` |
| GET | `/webhooks/instagram` | – | `hub.*` handshake | challenge |
| POST | `/webhooks/instagram` | HMAC | raw JSON entry | `{received:true}` |

## FeedItem
```json
{
  "id": "…", "caption": "…", "mediaType": "VIDEO", "thumbnailUrl": "https://…",
  "videoUrl": "https://… | null", "permalink": "https://instagram.com/…",
  "likeCount": 12040, "commentCount": 640, "categories": ["tech"],
  "isCardMode": false, "liked": false, "saved": false,
  "creator": { "id": "…", "username": "bytebuddy" }
}
```
- `isCardMode = true` when Instagram omitted `video_url` (licensed audio) → the client renders thumbnail+caption card mode (spec §3.4).
- `nextCursor` = opaque pagination cursor (null when the page is the last).

## Mock vs live
`MOCK_MODE` is server config; the Android app uses the same contract via
`MockRepository` (offline) or `RemoteRepository` (HTTP) — switching is a build/config flag, never a code change.
