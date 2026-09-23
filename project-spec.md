# Project Spec: Ideas Capture App (Arabic)

## 1. Problem & Goal

The user currently dumps scattered thoughts, reminders, and ideas (links, text, voice notes, images) into messaging apps' "Saved Messages" as a workaround. Because there's no structure, these items pile up unread and unorganized — a "graveyard" of forgotten notes.

This app solves that by giving a fast, frictionless capture flow (seconds, no forced structure at the moment of capture) combined with a system that actively surfaces stale items instead of letting them rot silently.

**Secondary goal (important — affects how this spec should be used):** This is also a learning exercise. The developer (frontend specialist, no backend experience) is using an AI coding assistant (Cursor) to design, build, test, and ship a custom backend end-to-end, instead of using a BaaS like Supabase. The backend should be built the way a competent backend engineer would build it — idiomatic, secure, well-structured — not simplified for teaching purposes. At each major architectural decision, briefly explain the reasoning and trade-offs considered in `DECISIONS.md`, since the developer will need to be able to explain these choices later without having written the code line-by-line.

## 2. Users & Platform

- Multi-user web application.
- Mobile-first responsive design; must work well as an installable PWA (web app manifest + service worker).
- The service worker exists for installability and Web Push. Offline capture and offline reading are out of scope.
- UI language: Arabic by default (RTL). English is available from a language toggle; English layout is LTR. Digits stay Western (`1 2 3`). English UI wording stays short and plain.
- iOS limitations of the Web Share Target API and of Web Push are a known, accepted gap. Do not block MVP on iOS support.

## 3. Repository Structure (Monorepo)

Package manager: **pnpm workspaces**.

```
/apps
  /web        → Next.js (App Router), TypeScript, Tailwind CSS
  /api        → Node.js, Express, TypeScript
/packages
  /shared     → Shared Zod schemas & TypeScript types used by both apps
```

Frontend and backend are deployed as separate services but live in one repo so validation schemas and types are shared, not duplicated.

## 4. Tech Stack

The custom backend stays. Do not replace it with Supabase, Firebase, or any other BaaS, and do not move the API onto Vercel serverless.

**Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + TanStack Query + React Hook Form + Zod + Zustand

- TanStack Query owns server state (items, categories, tags, session user).
- Zustand owns UI state only (open modal, selected filters, recorder state). Do not mirror item lists in Zustand.

**Backend:** Node.js + Express + TypeScript + Prisma + Zod (schemas live in `packages/shared`) + JWT auth via `jsonwebtoken` + `bcrypt` (cost factor 12). Use these libraries; do not hand-roll password hashing or token crypto.

**Database:** PostgreSQL on Neon (free tier), accessed only by the API through Prisma.

**File storage:** Cloudflare R2 (S3-compatible, free tier: 10 GB-month Standard storage, no egress fee). R2 stores voice and image bytes only. Authorization stays in the Express API. Postgres does not store file bytes. Render's free disk is ephemeral, so it is not the file store.

**Infrastructure (all free tier):**

- Frontend hosting: Vercel.
- Backend hosting: Render free web service. It spins down after 15 minutes without inbound traffic and takes roughly a minute to spin back up. One service, always-on, is about 744 instance hours in a 31-day month; Render includes 750 free instance hours per workspace per month, so the keep-awake plan below fits with little margin. Railway is not the host: its free plan is a small monthly usage credit, not a dependable always-free service.
- Database: Neon.
- Reminder wake-ups: [cron-job.org](https://cron-job.org/en/) (free HTTP cron). It closes the connection after 30 seconds and reads at most 64 KB of the response.

## 5. Data Model

All timestamps are `timestamptz` stored in UTC. "Today" / "yesterday" are computed at read time. Never shift a stored timestamp to fake the user's day boundary.

A user's day starts at `day_start_time` (an integer hour, 0–23) in their IANA timezone. The day runs from that hour until the same hour on the next calendar date. Example: `day_start_time = 14` and `timezone = Africa/Cairo` means the day runs 14:00–14:00, not until some unrelated morning hour. If the local time of an instant is earlier than `day_start_time`, that instant belongs to the previous calendar date.

### User
- `id`
- `email` — unique, stored trimmed and lowercased
- `password_hash`
- `timezone` — IANA name (for example `Africa/Cairo`). Default it from the browser at registration; the user can change it in settings.
- `day_start_time` — integer hour 0–23. Default `0`.
- `reminders_enabled` — boolean, default `false`
- `reminder_times` — zero to three `HH:MM` values in the user's timezone. Ignored while reminders are disabled.

### Category
- `id`
- `user_id`
- `name` — user-created, unique per user (case-insensitive)
- `color` — one value from a fixed palette exported by `packages/shared` (not a free-form hex picker)

Deleting a category keeps its items and sets their `category_id` to null.

### Tag
- `id`
- `user_id`
- `name` — user-created, unique per user (case-insensitive), many-to-many with Item

Deleting a tag detaches it from items. Items stay.

### Item
- `id`
- `user_id`
- `type` — enum: `link | text | voice | image`
- `content`
  - `text`: the body
  - `link`: the URL
  - `voice` / `image`: the private R2 object key, not a public URL
- `link_preview` — nullable JSON `{ site_name, title, description, image_url }`, only for `type = link`, and only when the fetch succeeded. `image_url` is the remote image URL; do not copy preview images into R2.
- `category_id` — nullable. Null means uncategorized. It does not imply a status.
- `tags` — many-to-many, zero or more
- `status` — enum: `inbox | active | done | archived`
- `created_at` — actual creation time. Revival does not change it.
- `last_touched_at` — set to `created_at` on insert. Updated only when the user edits content, changes status, changes category, adds or removes a tag, or presses Revive. Opening a card, loading a list, playing audio, and rendering the revival screen do not update it.

One image item holds one image. One voice item holds one audio clip.

### ClearEvent
Used so the daily counter still works after a permanent delete.

- `id`
- `user_id`
- `item_id` — nullable after the item row is gone
- `kind` — enum: `done | deleted`
- `created_at`

Entering `done` inserts a `done` event. Leaving `done` removes that item's `done` event if it falls in the current user-day. A permanent delete inserts a `deleted` event, which is not removed. Moving to `archived` writes no event.

### PushSubscription
- `id`
- `user_id`
- `endpoint`
- `p256dh`
- `auth`
- `created_at`

A user may have more than one subscription (more than one browser).

## 6. Core Features (MVP — build all of these)

### 6.1 Auth
Email/password registration and login. Registration opens a session immediately. Email verification and password reset are out of scope.

Session design:

- Access token lifetime: 15 minutes.
- Refresh token lifetime: 30 days, rotated on use. Store only a hash of the refresh token. Reuse of a rotated token revokes that session.
- Both tokens are `httpOnly`, `Secure` cookies. The web app (Vercel) and the API (Render) are different sites, so cookies use `SameSite=None`.
- CORS allows only the web origin and `credentials: true`. No `*` origin.
- Logout revokes the refresh token server-side and clears both cookies.
- Password rule: at least 8 characters. No extra composition rules.
- Rate-limit registration and login (for example 5 attempts per 15 minutes per IP + email).

Every protected endpoint must verify that the requesting user owns the resource. This is the single most important security requirement in this spec. Public R2 URLs are forbidden: playback and image bytes are streamed by the API after the ownership check.

### 6.2 Quick Capture Flow
- The Inbox is the list of items with `status = inbox`, plus the capture entry point. It is always reachable.
- No category and no tag are required at capture time. New items start as `status: inbox` and `category_id: null`.
- An input-type picker: link / text / voice / image. Selecting a type shows only that type's input.
- Capture stays short: no title field.

### 6.3 Link Preview
- On submit, the API fetches Open Graph metadata server-side: title, description, image, site name.
- The card shows site name, title, a short description, and the thumbnail, in the style of a Telegram link preview.
- The URL is stored in `content`. Preview JSON is stored only in `link_preview`.
- If the fetch fails or times out, the link item is still saved and the UI shows the URL with no preview card.
- SSRF constraints are mandatory: request timeout around 5 seconds, response size cap around 1 MB, at most a few redirects, and refuse private, loopback, link-local, and cloud-metadata addresses (including after redirects).

### 6.4 Voice Capture
- Record in the browser with `MediaRecorder` and store the blob as-is (typically WebM/Opus). Do not transcode to MP3 in MVP.
- Limits: 10 minutes and 15 MB, whichever is reached first. Reject over-limit uploads.
- Playback goes through the authenticated API. No transcription in MVP.

### 6.5 Image Capture
- One image per item, max 5 MB, shown as a thumbnail on the card and full size in the detail view.
- Bytes are served by the authenticated API after the ownership check.

### 6.6 Categories & Tags
- Fully user-created (create / rename / delete), no preset catalog.
- A category has a name and a palette color. A tag is a name only.
- Names are unique per user, case-insensitive. Two different users may use the same name.

### 6.7 UI: Card-Based Layout
Items are sticky-note style cards, not a table. Tapping a card opens the full detail.

Collapsed card content:

- Text: the first line of `content`.
- Link: preview title, or the URL when there is no preview.
- Image: thumbnail.
- Voice: duration and a play control.

Default sort: `created_at` descending. List endpoints are cursor-paginated, 30 items per page, cursor on (`created_at`, `id`).

Screens:

- Login / register
- Inbox (capture + `status = inbox`)
- All items, with filters
- Item detail
- Category and tag management
- Settings: timezone, day start hour, reminders
- Revival screen
- Voice playback lives on the card and the detail view, not on its own route

Empty Inbox: one short Arabic line explaining that capture does not require a category. No onboarding tour.

### 6.8 Filtering
Filters live on the all-items screen and should stay light, not an admin panel.

- Category, status, and type are single-select and combined with AND.
- Tags are multi-select and combined with OR.
- Example: one category AND one status AND one type AND (tag A OR tag B).

### 6.9 Day-Boundary Logic
"Today" / "yesterday" grouping uses `created_at` plus the user's `timezone` and `day_start_time`, as defined in section 5. The daily progress counter uses that same day window. Revival does not move an item into today, because it does not change `created_at`.

### 6.10 Item Lifecycle & Manual Delete
The user may move an item freely among `inbox`, `active`, `done`, and `archived`.

`active` is an explicit user action (a control meaning they intend to work on it). Assigning a category does not change status. Opening a card does not change status.

Permanent delete is a separate control, available from any status. It removes the row and writes a `deleted` ClearEvent. There is no silent auto-deletion.

### 6.11 Revival System (Anti-Graveyard)
An item is stale when `status` is `inbox` or `active` and `last_touched_at < now() - interval '7 days'`. `done` and `archived` items are never stale.

On app load, the client queries stale items. If any exist, show one revival screen listing all of them. Each row has:

- Delete — permanent remove (same as manual delete).
- Revive — set `last_touched_at` to now. Leave `created_at` and `status` unchanged.

This query runs on page load. It is not a cron job. Showing the screen is not a touch.

### 6.12 Daily Progress Indicator
A simple counter in the UI: how many items were cleared in the current user-day. Cleared means a `done` or `deleted` ClearEvent in that day window. `archived` does not count.

### 6.13 Reminders
Reminders are in the MVP. They are push notifications, not an in-app badge only.

- Default off. The user turns them on and picks 1 to 3 times of day (`HH:MM` in their timezone).
- Body is only the count of items in `inbox` or `active`. No titles and no item contents.
- The browser's PushSubscription is stored in `PushSubscription`.
- Sending is done by the API (VAPID Web Push), so the feature lives in this backend.

Wake-up design, because Render sleeps and cron-job.org gives up after 30 seconds:

- One cron-job.org job POSTs to the API dispatch route every 5 minutes. That is inside Render's 15-minute sleep window, so a healthy service stays warm and the handler can finish well under 30 seconds.
- The dispatch route is not user-authenticated. It requires a shared secret (`CRON_SECRET` header). It returns a short body (for example `OK`).
- For each user with reminders enabled, if a configured local time has been reached today and that slot was not already sent, send the push and record the slot so a later tick does not send it again.
- A tick that hits a cold start may die at 30 seconds while Render is still booting. The next tick, 5 minutes later, hits a warm process. Chosen times can therefore slip by a few minutes. That slip is accepted. iOS delivery gaps stay accepted.
- The 750-hour free allowance is almost entirely consumed by keeping this one service awake. Do not add a second always-on service.

### 6.14 Share Target (PWA)
Implement the Web Share Target API so the installed PWA appears in the Android share sheet.

- MVP accepts shared links only. Shared plain text and shared images are out of scope.
- A shared link becomes a `link` item in `inbox` (same preview rules as manual capture).
- If the user is logged out, keep the URL on the device, send them through login, then create the Inbox item. Do not drop the share on the login screen.

## 7. Explicitly Out of Scope for MVP (Backlog)

Do not build these now. The API should stay client-agnostic so a future non-browser client can call it.

- AI auto-categorization (suggest a category or tag, one tap to confirm, never auto-applied).
- Voice transcription.
- React Native (or any other) mobile client.
- Password reset and email verification.
- Search.
- Offline capture or offline reading.
- Data export.
- Account deletion.
- Sharing text or images into the PWA.
- Copying link-preview images into R2.
- Transcoding voice to MP3.

## 8. Non-Negotiable Engineering Requirements

1. **Cross-user access tests, automated.** For every endpoint that reads or writes user data, an automated test (Vitest + Supertest) must do this: register User A and User B, create the resource as A, then read, update, and delete it as B, and assert rejection. Include file streaming and push-subscription routes. Also give a `curl` (or Thunder Client) recipe after each implementation step so the same behavior can be checked without reading the code.
2. **Zod validation on every input**, with schemas in `packages/shared` used by both apps.
3. **A short running decision log** in `DECISIONS.md` for major choices (auth cookie shape, day-boundary math, why R2, why the cron tick). Write it so the developer can explain the choice later.
4. **Ownership checks on file bytes**, not security-through-obscure object keys.

## 9. Constraints

- Hosting and storage stay on free tiers: Vercel, Render free web service, Neon, R2, cron-job.org.
- Built solo, primarily by Cursor under human supervision.
- Time budget: roughly one week of focused work.
- Task breakdown generated from this spec should be the smallest reasonable number of tasks. Group related work. Do not schedule work day-by-day.

If that week slips, cut in this order, and stop at the first cut that makes the week fit. Do not cut reminders or voice capture ahead of the items below:

1. Share Target (section 6.14)
2. Image capture (section 6.5)
3. Link-preview fetching (section 6.3) — still save the URL as a `link` item
4. Daily progress indicator (section 6.12)

Auth, text and link and voice capture, categories and tags, day boundary, revival, and reminders stay.
