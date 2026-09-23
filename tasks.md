# ReviveNotes tasks

| ID | Title | Depends on |
| --- | --- | --- |
| T1 | Workspace and the full data model | None |
| T2 | Auth and session cookies | T1 |
| T3 | Categories and tags | T2 |
| T4 | Text and link capture, inbox, and detail | T2 |
| T5 | Day boundary and settings | T4 |
| T6 | Item lifecycle and clear events | T3, T4, T5 |
| T7 | All items and filters | T3, T4, T6 |
| T8 | Voice capture and playback | T6, T7 |
| T9 | Revival screen | T6, T8 |
| T10 | Reminders and web push | T5, T6 |
| T11 | Daily progress counter | T5, T6 |
| T12 | Link preview | T4, T6 |
| T13 | Image capture | T8 |
| T14 | Share target | T4, T10 |
| T15 | Note beside a link, image, or voice | T13 |

Build from the top of the index. One task is one later chat. A task lists the spec sections to open; do not load the rest of `project-spec.md` into that chat.

Direct dependencies are listed on each task. The index order is the build order.

API tests use the database in `DATABASE_URL`. A test deletes only the users it created, matched by email. No test wipes the user table.

If the week slips, skip from the end and stop at the first skip that fits: **T14**, then **T13**, then **T12**, then **T11**. T1 through T10 stay.

## T1 — Workspace and the full data model

- **Depends on:** None
- **Spec sections:** 2, 3, 4, 5

### In scope

Do this in one chat, in this order. Finish the schema in this chat; do not leave it for a later task.

**Workspace**

- pnpm workspaces with `apps/web`, `apps/api`, and `packages/shared`.
- Package names: `@revivenotes/web`, `@revivenotes/api`, `@revivenotes/shared`.
- Web: Next.js App Router, TypeScript, Tailwind. Root layout sets `lang="ar"` and `dir="rtl"`. Wrap the app in a TanStack Query provider. Install Zustand. One placeholder page is enough.
- API: Express and TypeScript. `apps/api/src/app.ts` exports the app without listening. `apps/api/src/server.ts` listens on port 4000. `GET /health` returns `{ "ok": true }`.
- Vitest and Supertest, started from the repo root with `pnpm test`. One test calls `GET /health`.
- Shared package exports a TypeScript entry both apps import. Install Zod there. Do not generate Zod from Prisma.
- `.gitignore` ignores `.env` and dependencies. `.env.example` lists `DATABASE_URL`, `WEB_ORIGIN=http://localhost:3000`, and `NEXT_PUBLIC_API_URL=http://localhost:4000`.
- `DECISIONS.md` records the stack: a separate Express API in this repo, Postgres through Prisma, files on R2 later. Supabase, Firebase, and an API deployed as Vercel serverless were rejected.

**Schema**

Prisma lives in `apps/api` only. One `schema.prisma`, one migration, a single Prisma client module the API imports. Check current Prisma docs for `timestamptz` before writing the attributes.

Models and constraints:

- **User:** `id` (cuid), `email` (unique), `password_hash`, `timezone` (IANA string), `day_start_time` (int, default 0), `reminders_enabled` (boolean, default false), `reminder_times` (string array, default empty).
- **RefreshSession:** `id`, `user_id`, `session_id`, `token_hash` (unique), `expires_at`, `replaced_at` (nullable), `revoked_at` (nullable), `created_at`. Index `session_id`. This table is the refresh-token store for T2.
- **Category:** `id`, `user_id`, `name`, `name_key`, `color`. Unique `(user_id, name_key)`.
- **Tag:** `id`, `user_id`, `name`, `name_key`. Unique `(user_id, name_key)`.
- **Item:** `id`, `user_id`, `type` (`link | text | voice | image`), `content` (string), `link_preview` (nullable JSON), `category_id` (nullable), `status` (`inbox | active | done | archived`, default `inbox`), `created_at`, `last_touched_at`, `duration_seconds` (nullable int, voice only). Indexes: `(user_id, created_at, id)`, `(user_id, status, last_touched_at)`, `(user_id, category_id)`.
- **ItemTag:** `item_id`, `tag_id`, unique pair.
- **ClearEvent:** `id`, `user_id`, `item_id` (nullable), `kind` (`done | deleted`), `created_at`. Index `(user_id, created_at)`.
- **PushSubscription:** `id`, `user_id`, `endpoint` (unique), `p256dh`, `auth`, `created_at`.
- **ReminderDelivery:** `id`, `user_id`, `local_date` (a calendar date, not a shifted timestamp), `slot` (`HH:MM`), `sent_at`. Unique `(user_id, local_date, slot)`.

Delete behavior:

- Deleting a user cascades to that user's rows.
- Deleting a category sets item `category_id` to null. The item row stays.
- Deleting a tag deletes join rows only. Items stay.
- Deleting an item sets `ClearEvent.item_id` to null and deletes that item's join rows.

`name_key` is the trimmed, lowercased display name, stored so uniqueness is a database constraint. `color` is a string id; the allowed values are added in T3.

Timestamps are `timestamptz` in UTC. Do not add `@updatedAt`. `duration_seconds` is on the item because the voice card shows a duration and the server will not probe the audio file.

In `DECISIONS.md`, record in the user's words: UTC storage, why `name_key` exists, why refresh sessions and reminder deliveries are tables now, and why `duration_seconds` is on the item.

Add a Vitest check, using Prisma, that two users may share a category `name_key` and one user may not. Delete those users at the end.

### Out of scope

Auth routes, feature screens, R2, seeds, deploy, and any section 6 behavior. No Zod schemas for features yet. No second database package.

### Rules that are easy to get wrong

- The API is the only code that talks to Postgres. The web app and `packages/shared` do not import Prisma.
- Do not shift a timestamp to fake a local day. `day_start_time` is stored as an integer hour. "Today" is computed later, at read time.
- Do not put file bytes in Postgres. `content` is text, a URL, or an object key.
- `link_preview.image_url` will stay a remote URL. There is no column for a copied preview image.
- Ownership will be checked in each route later. Do not add a Prisma middleware layer that hides that check.
- Field names in `schema.prisma` match the spec (`user_id`, `day_start_time`, `last_touched_at`). No rename layer.
- `.env` stays untracked. `.env.example` has empty secrets, not real keys.
- `tsx` is not in the spec. Before adding it to run the API, ask in one sentence: Node does not run TypeScript by itself. If the answer is no, compile with `tsc` and run `node`.

### Done when

`pnpm test` passes, including the health test and the category `name_key` test. The web placeholder renders right-to-left. One migration has created every model above. `DECISIONS.md` has the stack and schema entries.

### Confirm

1. Put a Neon `DATABASE_URL` in `apps/api/.env`. From the repo root run the migration, then `pnpm test`, then start the API and `curl http://localhost:4000/health`.
2. Open `http://localhost:3000` and confirm the document is Arabic and RTL.
3. Edge: the automated test inserts the same category `name_key` for two users (allowed) and twice for one user (rejected). If you inspect the database, those users are gone after the test.

## T2 — Auth and session cookies

- **Depends on:** T1
- **Spec sections:** 6.1, 6.7 (login and register only), 8

### In scope

Email and password registration and login. Registration opens a session immediately. The browser sends the IANA timezone from `Intl.DateTimeFormat().resolvedOptions().timeZone`. The server stores `day_start_time` 0, `reminders_enabled` false, and an empty `reminder_times`.

Shared Zod schemas in `@revivenotes/shared` for register and login. Email is trimmed and lowercased in the schema. Password is at least 8 characters and at most 72 bytes. No composition rules.

Routes on the API:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`
- `requireUser` middleware for later routes

Access token: a JWT from `jsonwebtoken`, lifetime 15 minutes, signed with `JWT_ACCESS_SECRET`. Refresh token: `crypto.randomBytes`, lifetime 30 days. Store only the SHA-256 hash in `RefreshSession`. Login creates a new `session_id`. Each browser has its own session.

Both tokens are `httpOnly`, `Secure`, `SameSite=None` cookies, names `access_token` and `refresh_token`, path `/`. CORS allows `WEB_ORIGIN` only, with `credentials: true`.

Refresh rotation happens only in `POST /auth/refresh`. The presented row must be unexpired, with `replaced_at` and `revoked_at` null. Issue a new row with the same `session_id`, set `replaced_at` on the old row, and set the new cookie. If the presented row is already replaced or revoked, set `revoked_at` on every row with that `session_id` and return 401. Logout sets `revoked_at` on every row in that session and clears both cookies. Other browsers stay logged in.

`GET /me` returns `id`, `email`, `timezone`, `day_start_time`, `reminders_enabled`, `reminder_times`. Never return `password_hash` or tokens.

Passwords use bcrypt cost 12. Unknown email and wrong password return the same Arabic error. A taken email on register may say the email is in use.

Rate-limit register and login: 5 attempts per 15 minutes per IP plus email, in memory in this process. The 6th attempt returns 429. Record in `DECISIONS.md` that this counter resets when the process restarts, and that Redis was rejected because it would be a second service.

Web:

- Arabic RTL login and register forms, using React Hook Form and the shared Zod schemas. Each input has a visible Arabic label.
- `apps/web/lib/api.ts` sends `credentials: "include"` and prefixes `NEXT_PUBLIC_API_URL`. On 401, one shared refresh runs and the original request retries once. A second 401 sends the user to login. Parallel 401s wait on that same refresh.
- A logged-in visit to `/inbox` may render one temporary Arabic line. T4 replaces that page.
- Logout control is visible after login.
- Authenticated pages call `/me` and redirect to login when the session is gone. The API still checks the cookie on every protected route.

Before adding `@hookform/resolvers`, ask in one sentence: it connects React Hook Form to the shared Zod schema. If the answer is no, call `safeParse` in the submit handler and keep React Hook Form for the fields.

In `DECISIONS.md`, record the cookie shape, why `SameSite=None`, why the refresh token is opaque and hashed with SHA-256, and why reuse revokes one `session_id` only.

Append `JWT_ACCESS_SECRET` and `WEB_ORIGIN` to `.env.example` if T1 did not already list `WEB_ORIGIN`.

### Out of scope

Password reset, email verification, items, categories, and any screen except login, register, and the temporary inbox placeholder.

### Rules that are easy to get wrong

- Do not store tokens in `localStorage` or `sessionStorage`.
- Do not drop `Secure` or switch to `SameSite=Lax` on localhost. The web app and the API are different ports, so they are different sites. Chromium treats `http://localhost` as a secure context, so the `Secure` cookie still sticks there.
- Do not bcrypt the refresh token. bcrypt is for the password. The refresh token is already random.
- Do not put the access token in the JSON body.
- CORS must not use `*`.
- A missing, expired, or bad refresh token returns 401 and does not revoke any other session. A missing or bad access token on `/me` returns 401. Later tasks return 404 when an id is missing or owned by someone else, so the caller cannot tell those cases apart.
- Lifetimes are constants: 15 minutes and 30 days. Do not make them env overrides.
- Rate-limit tests must expect 429. Do not raise the limit so the suite goes green.

### Done when

Register, login, `/me`, refresh, logout, reuse revocation, the 7-character password, the taken email, and the 6th attempt are covered by Vitest + Supertest. User B's cookie never returns user A's email. The login and register pages are Arabic and RTL. `DECISIONS.md` has the session entry.

### Confirm

1. Start both apps. Register from the form with a timezone and a password of at least 8 characters. You land on `/inbox` and see the temporary line. Logout, then log in again.
2. With curl, save cookies on login, call `GET /me` with those cookies, then `POST /auth/logout` and confirm `/me` returns 401.
3. Edge: call `POST /auth/refresh` and keep the old refresh cookie. Call refresh again with that old cookie. The second call returns 401, and `/me` with the new access cookie from the first refresh also returns 401. A second browser logged in as the same user still works.

## T3 — Categories and tags

- **Depends on:** T2
- **Spec sections:** 5 (Category and Tag), 6.6, 8

### In scope

User-created categories and tags. No preset catalog.

Shared Zod schemas. Export `CATEGORY_COLORS` from `@revivenotes/shared`: `red`, `orange`, `amber`, `green`, `teal`, `blue`, `violet`, `pink`. The web maps each id to a Tailwind class. Store the id in `color`.

Routes, all behind `requireUser`:

- `GET /categories`, `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id`
- `GET /tags`, `POST /tags`, `PATCH /tags/:id`, `DELETE /tags/:id`

Names are trimmed. `name_key` is the trimmed name lowercased. Uniqueness is per user. Two users may use the same name. A duplicate for the same user returns 400.

Deleting a category deletes the category row and leaves items, with `category_id` null. It does not change item `status` or `last_touched_at`. Deleting a tag removes join rows and leaves items. It does not change `last_touched_at`.

One Arabic management screen for both. The category form has a name and those eight swatches, not a hex input. The tag form has a name only. Rename and delete are on that screen. Add a link to this screen from the signed-in shell.

The items API does not exist yet. The delete tests may insert an item and a join row through Prisma, then call the API, then delete the test users.

### Out of scope

Assigning a category or tag on an item (T6), filters (T7), and any preset categories.

### Rules that are easy to get wrong

- Reject a color that is not in `CATEGORY_COLORS`. Do not accept a hex typed by the user.
- Do not use `style={{}}` for the swatch. Use a Tailwind class chosen from the id.
- Compare names by `name_key`, not by the display casing.
- A route that loads by id uses `findFirst` with `id` and `user_id`. Another user's id returns 404, the same as a missing id.
- Deleting a category is not a touch and not a status change.
- The screen copy is Arabic. Digits, if any, are Western.

### Done when

Vitest + Supertest covers create, rename, and delete for both resources, the case-insensitive duplicate, the shared name across two users, the palette rejection, category delete leaving an item with `category_id` null, and tag delete leaving the item. User B gets 404 on read, update, and delete of A's rows. The management screen can create, rename, and delete both.

### Confirm

1. Log in, open the management screen, create a category with a swatch and a tag, rename each, and delete each.
2. Edge: as two users, create a category named `أفكار` for both (both succeed). As one user, create `Work` and `work` (the second returns 400). `pnpm test` also deletes a category that an item points at and asserts the item remains with `category_id` null. The items screen does not exist yet, so that check stays in the test.

## T4 — Text and link capture, inbox, and detail

- **Depends on:** T2
- **Spec sections:** 6.2, 6.7, 8

### In scope

Create and read text and link items. The inbox is the capture entry plus items with `status = inbox`.

`POST /items` accepts JSON `{ type, content }` where `type` is `text` or `link`. New rows: `status = inbox`, `category_id` null, `link_preview` null, `last_touched_at` equal to `created_at`. Text `content` is the body, from 1 to 10,000 characters. Link `content` is the URL, up to 2,000 characters. No title field.

`GET /items` is cursor-paginated, 30 per page, `ORDER BY created_at DESC, id DESC`. The cursor is the last row's `created_at` and `id`. The next page drops the cursor row and every newer row: `created_at` less than the cursor, or the same `created_at` and `id` less than the cursor. Query params in this task: `status` and `cursor` only. Response shape: `{ items, next_cursor }`. `next_cursor` is null on the last page. The inbox calls `GET /items?status=inbox`.

`GET /items/:id` returns the owner's item. It does not change `last_touched_at`.

Voice and image stay out of the JSON schema. The database enum already allows them.

Web, Arabic RTL:

- Replace the T2 inbox placeholder. Capture sits on the inbox only.
- A type picker with text and link. Choosing one shows only that input. Each input has a visible Arabic label. `CaptureForm` switches on the selected type so a later task can add a branch.
- `ItemList` and `ItemCard` live next to the inbox screen. Text shows the first line of `content`. Link shows the URL. Tapping the card goes to `/items/[id]`.
- Detail shows the full text or the URL. No status controls yet.
- Empty inbox: one short Arabic line that capture does not need a category. No tour.
- A "load more" button when `next_cursor` is set. TanStack Query holds the pages. Do not copy the item list into Zustand.
- Add an Inbox link in the signed-in shell.

Shared Zod schemas for create and for the list query. Record the 10,000 and 2,000 limits in `DECISIONS.md` in one line.

### Out of scope

All-items, filters, preview fetch, voice, image, status changes, delete, day labels, and revival.

### Rules that are easy to get wrong

- Capture does not require a category or a tag, and it has no title.
- Do not update `last_touched_at` on list or detail loads.
- Do not build a public URL for `content`.
- Another user's item returns 404. Their items never appear in your list.
- Page size stays 30. Do not change the cursor pair later. T7 adds filters inside the same order.
- Cards, not a table. Tailwind only. One component per file. The file name matches the default export.
- Western digits if a count is shown.

### Done when

Supertest covers create, get, and list; user B gets 404 on A's item and does not see it in a list; `GET` leaves `last_touched_at` unchanged; 31 items return 30 then 1. The inbox shows a text card and a link card, the empty line before the first capture, and the detail page. Link cards show the URL and no preview block.

### Confirm

1. Log in, confirm the empty Arabic line, capture a text note and a link with no category, and open each card.
2. Edge: run `pnpm test` and confirm the 31st item is on the second page. Curl `GET /items/:id` as user B and get 404.

## T5 — Day boundary and settings

- **Depends on:** T4
- **Spec sections:** 5 (opening paragraphs), 6.9, 8

### In scope

One server function, `getUserDayRange(timezone, dayStartHour, instant)`, in `apps/api/src/user-day.ts`. A user's day runs from `day_start_time` in their IANA timezone until the same hour on the next calendar date. If the local time of an instant is earlier than that hour, the instant belongs to the previous calendar date. Return the UTC start, the UTC end, and the local date string `YYYY-MM-DD` for that window.

The list endpoint adds `local_date` on each item, computed at read time from `created_at`. `ItemList` prints a day label when `local_date` differs from the previous card in the loaded list. Do not fetch every item to build groups. Only the inbox exists in this task. T7 reuses `ItemList` for all-items, so the label is not written a second time.

Settings page, Arabic, linked from the shell:

- Timezone choices from `Intl.supportedValuesOf("timeZone")`.
- Day-start hour as a select from 0 through 23, Western digits.
- `PATCH /me` updates `timezone` and `day_start_time` only. Shared Zod schema `updateSettingsSchema`. Reject an invalid timezone and an hour outside 0–23.
- `GET /me` already returns these fields.

Leave a clear empty section at the bottom of the settings page for reminders.

In `DECISIONS.md`, explain the Cairo example: `day_start_time = 14` and `Africa/Cairo` means the day runs 14:00–14:00. An instant at 13:00 local belongs to the previous calendar date. Rejected: storing timestamps already shifted into local time.

Tests call the function directly with fixed instants, not the clock at run time. Cover `Africa/Cairo` at local 13:00 and local 14:00. Cover one timezone that observes DST with an instant just before the local start hour and one just after it, and assert the calendar dates differ by one day. Do not hardcode a UTC offset from memory; let `Intl` do the conversion and assert the dates it produces.

### Out of scope

The all-items screen (T7), the daily progress counter (T11), reminder times (T10), changing `created_at`, and revival.

### Rules that are easy to get wrong

- Never write a shifted timestamp back to the row.
- Revival and this task do not move an item into today. `created_at` stays the creation time.
- `day_start_time` is not "14 hours after midnight UTC". Convert in the user's timezone.
- Hour 0 is midnight. The select includes 0 and 23.
- Do not reimplement this math in the web app. The web displays `local_date`.
- A page boundary may repeat a heading on the next page. Leave that as it is.
- Copy is Arabic. The hour digits are Western.

### Done when

The function tests cover local 13:00, local 14:00, and the DST pair. `PATCH /me` rejects hour 24 and a fake timezone. User B's patch does not change A's timezone. The inbox shows a day label from `local_date`. Settings saves a new hour and the next list uses it.

### Confirm

1. In settings, set `Africa/Cairo` and day start `14`. Save. Reload the inbox and read the day label.
2. Edge: `pnpm test` asserts that 13:00 local in `Africa/Cairo` belongs to the previous calendar date and 14:00 local belongs to that calendar date. In the app, if the local hour is 0 through 22, set day start to the next hour, reload, and confirm the new item's label is the previous calendar date. Set day start back to `0` and confirm the label is today's calendar date. If the local hour is already 23, the test is the edge.

## T6 — Item lifecycle and clear events

- **Depends on:** T3, T4, T5
- **Spec sections:** 5 (Item touch rules and ClearEvent), 6.10, 8

### In scope

The user may move an item among `inbox`, `active`, `done`, and `archived`. Permanent delete is a separate action from any status.

`PATCH /items/:id` accepts any of: `content`, `status`, `category_id`, `tag_ids`. `tag_ids` is the full set. Shared Zod schema. `category_id` may be null.

`last_touched_at` updates only when the saved value changes for content, status, category, or the tag set. Sending the same values does not touch the row. `created_at` never changes here.

Assigning a category does not change `status`. `active` happens only when the user sets that status.

Clear events, using `getUserDayRange` for the current user-day:

- Entering `done` inserts one `done` event. If the item is already `done`, do not insert another.
- Leaving `done` deletes that item's `done` events whose `created_at` falls in the current user-day. Older `done` events stay.
- Permanent delete inserts a `deleted` event, then deletes the item. The event remains with `item_id` null. It is not removed later.
- Moving to `archived` writes no event.

Editing a link's URL sets `link_preview` to null.

`DELETE /items/:id` is the permanent delete.

Detail page, in Arabic, gains: status controls, category select, tag picker, content edit for text and link, and a separate delete control. The card stays a summary. Play controls are added later on the card; do not add status buttons to the card.

### Out of scope

Revive (T9), the progress counter (T11), voice, image, and preview fetch.

### Rules that are easy to get wrong

- Opening the detail `GET` is not a touch. This was true in T4; keep it true.
- Category assignment is not a status change.
- Archive writes nothing. Delete writes `deleted` and the event survives the item.
- Leaving `done` removes only the current user-day's `done` event. Use the day helper. Do not compare UTC dates as if they were local dates.
- Another user's patch or delete returns 404.
- A `category_id` or tag id owned by someone else returns 400 and does not attach their row.
- Delete and status live on the detail page. Capture still has no required category.

### Done when

Supertest covers each status move, the `done` insert, leaving `done` today, leaving an older `done` event in place, archive writing nothing, delete leaving a `deleted` event with a null `item_id`, category assignment keeping status, a no-op patch keeping `last_touched_at`, and user B getting 404 on patch and delete. The detail screen can do each of those actions.

### Confirm

1. Open a text item, set a category, and confirm the status is still `inbox`. Move it to `done`, then to `archived`. The item remains.
2. Edge: move it back to `done`, then to `inbox` on the same user-day, and confirm the `done` event for that item in the current window is gone. Permanently delete another item, confirm the row is gone, and confirm a `deleted` event remains. Curl the delete as user B on a surviving item and get 404.

## T7 — All items and filters

- **Depends on:** T3, T4, T6
- **Spec sections:** 6.8, 8

### In scope

The all-items screen and the filter query on the existing list endpoint.

Add optional query params: `category_id`, `type`, and repeated `tag`. `status` already exists. Category, status, and type are one value each and combine with AND. Tags combine with OR. No tag param means tags are not filtered. No `status` means every status.

Example: one category AND one status AND one type AND (tag A OR tag B). An item with tag A and a different category stays out.

Same cursor and same `ORDER BY created_at DESC, id DESC` as T4. The cursor is the position inside the filtered query.

Web:

- `/items` shows all items and the filter controls. Capture stays on the inbox only.
- Zustand stores the selected filters for this screen only. TanStack Query stores the item pages.
- Move `ItemList` and `ItemCard` to `apps/web/components/items/` because a second screen now uses them. Keep the day label `ItemList` already prints. The filter controls stay next to the all-items screen.
- Add an All items link in the shell.
- Empty filter result: one short Arabic line. No tour.

### Out of scope

Changing capture, detail actions, the day-label rules, and pagination size.

### Rules that are easy to get wrong

- Tags are OR. Category, status, and type are AND. Do not OR the category with the tags.
- Do not store the item array in Zustand.
- Do not invent a second list endpoint or a second cursor format.
- A category id owned by the other user filters to an empty page, not to their items.
- Do not drop `local_date` when moving `ItemList`.
- Western digits. Arabic copy. Tailwind only.

### Done when

Supertest covers the AND/OR example, an empty tag filter, and user B not seeing A's items while filtering. The all-items screen sets each filter and loads the next page. The inbox still shows only `status = inbox`, still has capture, and still shows day labels.

### Confirm

1. On two notes, set categories and tags from the detail page. On All items, pick one category and two tags. Only items in that category with either tag remain.
2. Edge: an item that has one of those tags and the other category stays hidden. Curl the same query as user B and get none of A's items.

## T8 — Voice capture and playback

- **Depends on:** T6, T7
- **Spec sections:** 6.4, 8

### In scope

Record one clip in the browser with `MediaRecorder`. Upload the blob as-is. Do not transcode to MP3.

The client stops the recorder at 10 minutes and sends `duration_seconds` from that timer. The server rejects a body over 15 MB, an empty body, and a duration over 600 seconds. A duration from 0 through 600 is accepted. Allowed types: `audio/webm` and `audio/ogg`.

`POST /items/voice` is multipart, field name `audio`, plus `duration_seconds`. Create the item row (`type = voice`, `status = inbox`, `category_id` null), put the bytes in R2, store the private object key in `content`, store `duration_seconds`. If the put fails, delete the row. Check the size before the put. The object key looks like `{user_id}/{item_id}.webm` (or `.ogg`). It is not a public URL.

`GET /items/:id/file` loads the item with `id` and `user_id`, then streams the object. Set `Content-Type` from the key extension. This route does not change `last_touched_at`. Image capture will call this same route later. Do not add a second URL scheme.

R2 env vars in `.env.example`: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`. The bucket stays private.

Before adding `@aws-sdk/client-s3`, ask in one sentence: R2 speaks the S3 API, and this client is how the API puts and reads objects. Before adding a multipart parser such as `multer`, ask in one sentence: the voice body is a file, and Express does not parse multipart by itself.

Web:

- Add a voice branch to `CaptureForm`. Zustand holds recorder state only (recording or not, elapsed seconds). The item list stays in TanStack Query.
- The card and the detail view show the duration in Western digits and a play control. Fetch the bytes with `credentials: "include"`, play the blob, and revoke the object URL when the control unmounts. Do not set `src` to the R2 host or to the raw key.
- The play control does not navigate to detail. Playing does not change status or `last_touched_at`.
- The card's play button has an Arabic accessible name.

In `DECISIONS.md`, record why bytes live in R2 and are streamed by the API. Rejected: a public bucket URL, bytes in Postgres, and Render's disk.

### Out of scope

Transcription, MP3, image upload, and a waveform UI.

### Rules that are easy to get wrong

- No public R2 URL in JSON, in the audio element, or in logs that the client reads.
- The stream route's ownership check is the same `findFirst` with `user_id`. User B gets 404 and no bytes.
- Do not update `last_touched_at` when streaming.
- Reject over-limit uploads. Do not trim them down to 15 MB and save a partial clip.
- One voice item holds one clip.
- Do not add ffmpeg or a duration probe. The client timer and the byte limit are the gates.
- The service worker does not exist yet. Do not cache the audio response in a new worker here.

### Done when

Supertest covers a small valid upload, a body over 15 MB, a duration over 600, user B getting 404 on the file route, and a stream that leaves `last_touched_at` unchanged. The inbox can record, show the duration, and play the clip back on the card and on the detail page. `DECISIONS.md` has the R2 entry.

### Confirm

1. Record a short note, see it on the inbox card with a duration, play it there, open detail, and play it again. Reload and play it again.
2. Edge: curl an upload larger than 15 MB and get a rejection. Confirm no item row was left for it. Curl `GET /items/:id/file` as user B and get 404.

## T9 — Revival screen

- **Depends on:** T6, T8
- **Spec sections:** 6.11, 8

### In scope

An item is stale when `status` is `inbox` or `active` and `last_touched_at` is more than 7 × 24 hours before the current instant. `done` and `archived` are never stale. Do not pass that window through `day_start_time`.

`GET /revival` returns every stale item for the caller. This path is not under `/items/:id`. Showing it does not change `last_touched_at`.

`POST /items/:id/revive` sets `last_touched_at` to now. It does not change `created_at` or `status`.

Delete on this screen calls the existing `DELETE /items/:id`.

Web: when the signed-in shell loads, query revival once. If the list is non-empty, show one Arabic screen of those items instead of the page. Reuse `ItemCard` so voice can play, plus Delete and Revive. Playing is not a touch. When none remain, show the normal page. Do not query again on every client-side navigation. This is not a cron job.

### Out of scope

Changing the 7-day rule, auto-delete, and a revival nav item that runs the query on every visit.

### Rules that are easy to get wrong

- Rendering the screen is not a touch. Revive is a touch.
- Revive does not move the item to today and does not change `status`.
- An old `done` or `archived` item stays off the list.
- User B does not see A's stale items, and B gets 404 on revive and on delete.
- Do not paginate this list in this task.
- The play control still must not update `last_touched_at`.

### Done when

Supertest covers the 7-day boundary, exclusion of `done` and `archived`, revive leaving `created_at` and `status` as they were, `GET /revival` leaving `last_touched_at` unchanged, and user B's empty list plus 404 on revive. The screen appears on a full load when a stale item exists and goes away after each row is revived or deleted.

### Confirm

1. Set one of your inbox items' `last_touched_at` to 8 days ago. Reload the app. The revival screen lists it. Press Revive. The row leaves, `status` is still `inbox`, and `created_at` is unchanged. Reload: the screen does not return for that item.
2. Edge: set an `archived` item to 8 days ago, reload, and confirm it is absent. Curl `POST /items/:id/revive` as user B and get 404.

## T10 — Reminders and web push

- **Depends on:** T5, T6
- **Spec sections:** 4 (Render sleep and cron-job.org), 6.13, 8

### In scope

Reminders are Web Push, default off. The user turns them on and picks 1 to 3 times as `HH:MM` in their timezone. The body is only the count of items in `inbox` or `active`. No titles and no item contents. Send that count even when it is 0.

Extend `updateSettingsSchema` and `PATCH /me` with `reminders_enabled` and `reminder_times`. When enabling, require 1 to 3 unique `HH:MM` values. When disabled, store the flag and ignore the times. Add this block to the empty section on the settings page.

`POST /push-subscriptions` stores `endpoint`, `p256dh`, and `auth` for the caller. The same endpoint updates that row instead of duplicating it. `DELETE /push-subscriptions/:id` deletes only the caller's row. A user may have more than one subscription.

`POST /reminders/dispatch` is not user-authenticated. It requires header `x-cron-secret` equal to `CRON_SECRET`. Missing or wrong secret returns 401. Success returns a short body, `OK`.

For each user with reminders enabled, for each configured time: if the clock in `timezone` has reached that `HH:MM` and no `ReminderDelivery` exists for that user, that calendar date in that timezone, and that slot, send the push and then insert the delivery row. Do not add `day_start_time` to the slot. Do not insert the row if the send throws. A later tick sends the missed users. A second tick does not send the same slot again. A dead subscription (HTTP 404 or 410 from the push service) deletes that subscription row. There is no retry queue.

The service worker handles `push` and `notificationclick` only. It does not cache pages, API calls, or media. The manifest makes the app installable: name `ReviveNotes`, `start_url`, `display`, and one simple icon. No `share_target` yet.

Before adding the `web-push` package, ask in one sentence: the API needs it to send VAPID Web Push. Env in `.env.example`: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.

Check current Next.js docs for where the manifest and service worker go. Do not guess the file location.

In `DECISIONS.md`, record the 5-minute cron, the secret header, and why there is no second always-on service. A cold start may die around 30 seconds; the next tick finishes the work. That slip is accepted. iOS delivery gaps are accepted.

The cron-job.org job itself is a manual step once the API has a public URL: POST the dispatch route every 5 minutes with the header. Local "done" does not wait for that.

### Out of scope

Share target, a second worker service, in-app badge as a substitute for push, and item text inside the notification.

### Rules that are easy to get wrong

- The dispatch route has no user session. The secret is the gate. Do not leave it open.
- The notification body is the count only.
- Slot identity is the calendar date in `timezone` plus `HH:MM`. It is not the day-start window from T5.
- Write the delivery row after a successful send, or a crash will skip that user forever. A repeat tick must not double-send a row that was written.
- User B gets 404 deleting A's subscription. B's list of subscriptions is not this feature; there is no list of another user's endpoints.
- The service worker must not answer item or file requests from cache.
- One Render web service is the whole backend. Do not add a worker service.
- Digits in the notification count and in the time inputs are Western. The surrounding UI is Arabic.

### Done when

Supertest covers the missing secret, a second tick not writing a second delivery for the same slot, settings validation (0 times and 4 times rejected when enabled), and user B getting 404 on A's subscription delete. The push send is mocked in the test. The settings page can enable two times. The browser can store a subscription after permission. `DECISIONS.md` has the cron entry. The manifest is installable in Chromium without a share target.

### Confirm

1. In settings, turn reminders on, pick two times, allow notifications, and confirm a row in `PushSubscription`.
2. Curl `POST /reminders/dispatch` with the secret and see `OK`. Curl it again and confirm no second `ReminderDelivery` for the same slot.
3. Edge: curl dispatch with no header and get 401. Set a slot in the past for today, run dispatch once, delete that delivery row, run dispatch again, and confirm one new row (the missed slot still sends).

## T11 — Daily progress counter

- **Depends on:** T5, T6
- **Spec sections:** 6.12, 8

### In scope

`GET /progress/today` returns `{ "cleared": number }`. Count `ClearEvent` rows for the caller whose `kind` is `done` or `deleted` and whose `created_at` falls in the current user-day from `getUserDayRange`. `archived` does not count. There is no separate event to ignore beyond that, because archive writes nothing.

Show the number in the signed-in shell, Western digits, with a short Arabic label. TanStack Query loads it. Invalidate it after a status change or a delete, including a delete from the revival screen.

### Out of scope

A history chart, per-day browsing, and counting `archived`.

### Rules that are easy to get wrong

- Use the same day window as T5. Do not count by UTC midnight.
- A `done` event removed when the user leaves `done` today drops the count. An older `done` event stays out of today's count.
- A `deleted` event stays after the item is gone and still counts if its time is in the window.
- User A's events do not change user B's count.
- This is a skippable task. Do not fold extra item behavior in to make the number move.

### Done when

Supertest covers a `done` event today, a `deleted` event today, an `archived` item with no event, a `done` event from the previous user-day, and user B's count staying 0 while A's count is non-zero. The shell shows the number and updates it after marking done.

### Confirm

1. Note the count, mark an item done, and see the count rise by 1.
2. Edge: move that item back to `inbox` on the same user-day and see the count fall by 1. Permanently delete a different item and see the count rise by 1 and stay there after the row is gone.

## T12 — Link preview

- **Depends on:** T4, T6
- **Spec sections:** 6.3, 8

### In scope

When `POST /items` creates a link, the API fetches Open Graph title, description, image, and site name. Store them only in `link_preview` as `{ site_name, title, description, image_url }`. `content` stays the URL the user entered. `image_url` stays the remote image URL. Do not copy that image into R2.

If the fetch fails, times out, or is refused, the link item is still saved and `link_preview` is null.

On `PATCH`, when the URL content changes, run the same fetch. T6 already clears `link_preview` on a URL change; this task fills it again when the fetch succeeds.

The guard is a plain function:

- Allow only `http` and `https`.
- Timeout around 5 seconds.
- Read at most about 1 MB.
- Follow only a few redirects, and run this same address check on every hop.
- Resolve the hostname and refuse the URL when any address is private, loopback, link-local, or a cloud-metadata address. Checking the hostname text alone is not enough.
- Refuse `127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1`, and metadata host names.

Use `fetch`. Do not add a scraping package without asking first, in one sentence.

The link branch of `ItemCard` and the detail page show site name, title, a short description, and the thumbnail when `link_preview` is set, in the style of a Telegram link card. When it is null, show the URL as T4 already does. The thumbnail `src` is the remote `image_url`, not an R2 URL.

In `DECISIONS.md`, record the SSRF limits and the rejection of copying preview images into R2.

### Out of scope

A preview for text, voice, or image items. Sharing into the PWA (T14). Rewriting capture.

### Rules that are easy to get wrong

- A refused fetch still saves the link.
- Check the address after each redirect, not only the first URL.
- Do not put the preview image in the R2 bucket.
- Do not put the preview JSON in `content`.
- The thumbnail is the remote URL. Voice and image bytes stay on the authenticated file route.
- User B still gets 404 reading A's item, including its preview.

### Done when

Supertest saves an item for `http://127.0.0.1/` with `link_preview` null, and the guard refuses a redirect chain that ends at `169.254.169.254`. A normal public URL either stores a preview or, if the network blocks it, still stores the item. The card shows the preview when the JSON exists and the URL when it does not. `DECISIONS.md` has this entry.

### Confirm

1. Submit a public `https` URL. The inbox card shows the title and site name when the fetch succeeds.
2. Edge: submit `http://127.0.0.1/`. The item is in the inbox, the card shows that URL, and `link_preview` is null.

## T13 — Image capture

- **Depends on:** T8
- **Spec sections:** 6.5, 8

### In scope

One image per item, max 5 MB. Allowed types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`.

`POST /items/image` is multipart, field name `image`. Same R2 client and the same private-key pattern as voice: `{user_id}/{item_id}.jpg` (or the matching extension). `type = image`, `content` is the object key, `status = inbox`, `category_id` null. Check the size before the put. If the put fails, delete the row. Do not leave an object behind when the row is rejected.

Playback and display use the existing `GET /items/:id/file` route. Do not add a second stream path and do not return a public URL.

Web: an image branch on `CaptureForm`. The card shows a thumbnail. Detail shows the image full size. Load bytes with `credentials: "include"` and an object URL, then revoke it on unmount. Do not point `img` at the key or at R2.

### Out of scope

A second image on the same item, editing the image in place, voice changes, and copying link-preview thumbnails.

### Rules that are easy to get wrong

- 5 MB is the image cap. 15 MB was the voice cap. Do not share one limit.
- User B gets 404 on the file route for A's image, with no bytes.
- Streaming does not change `last_touched_at`.
- One image item holds one image.
- Reject the upload before putting an over-size object in the bucket.
- Tailwind only. The thumbnail is the authenticated blob, not a CSS background URL of the key.

### Done when

Supertest covers a small image, a file over 5 MB with no row and no object left behind, user B's 404 on the file route, and an unchanged `last_touched_at` after streaming. The card shows the thumbnail and detail shows the full image after a reload.

### Confirm

1. Upload a photo under 5 MB. See the thumbnail on the inbox card, open detail, and see it larger. Reload and confirm it still loads.
2. Edge: upload a file over 5 MB, get a rejection, and confirm there is no new image item. Curl the file route of a real image as user B and get 404.

## T14 — Share target

- **Depends on:** T4, T10
- **Spec sections:** 2 (PWA and iOS gap), 6.14

### In scope

The installed PWA shows up in the Android share sheet for links. Add `share_target` to the manifest from T10. Method GET, action `/share`, query param `url`.

`/share` reads that URL. If the user is logged in, `POST /items` with `{ type: "link", content: url }` and go to the inbox. If a link preview task is already in the API, that same create path fills the preview. Do not add a second fetch here.

If the user is logged out, store the URL on the device (`sessionStorage`), send them through login or register, and create the item after the session exists. Do not drop the URL on the login screen. Clear the stored URL after a successful create. Hook this into the login and register success path from T2.

Shared plain text and shared images are ignored. No item is created for them.

iOS gaps for the share sheet are accepted. Do not block this task on an iPhone.

The service worker from T10 stays push-only. Do not cache `/share` or the create request.

### Out of scope

Sharing text or images into the PWA, a native share extension, and any new item API.

### Rules that are easy to get wrong

- Logged-out shares survive the login redirect. The URL is stored on the device, then created once.
- Use the existing link create. Do not open a second preview implementation.
- Ignore shared text and shared files.
- A created share is an inbox link with no required category, same as manual capture.
- Do not turn the service worker into an offline cache to make share feel reliable.

### Done when

An installed Chromium PWA appears for a shared link. A logged-in share becomes one inbox link. A logged-out share becomes one inbox link after login, and the stored URL is cleared so a second login does not create it again. A shared plain-text payload creates nothing. iOS is not a blocker.

### Confirm

1. Install the app from Chromium, share a link from another site while logged in, and see one new inbox link.
2. Edge: log out, share a link, confirm the login screen did not throw the URL away, log in, and see exactly one new inbox item. Share plain text and confirm the inbox did not gain an item.

## T15 — Note beside a link, image, or voice

- **Depends on:** T13
- **Spec sections:** 6.2, 6.7. This field is not in the original spec. Record the choice in `DECISIONS.md`.

### In scope

A text item already stores the words in `content`. A link stores the URL there, and a voice or image item stores the private object key there. Add a separate optional `note` so the user can write words next to a link, an image, or a voice clip.

`note` is nullable text, trimmed, max `TEXT_MAX_LENGTH`. An empty note is stored as `null`. The Zod schema lives in `packages/shared` and is used by both apps.

Capture:

- Link: the URL field stays, plus an optional note field on the same form. `POST /items` accepts `{ type: "link", content, note? }`.
- Image: the file field stays, plus an optional note. `POST /items/image` reads the note from the multipart body, field name `note`.
- Voice: the recorder stays, plus an optional note. `POST /items/voice` reads the note from the multipart body, field name `note`.

The card shows the note under the link, the thumbnail, or the voice duration when it is present. Detail shows the same note in a textarea. Saving it is a touch: `last_touched_at` moves, and `content` does not. A link note does not clear or refetch `link_preview`. A voice or image note does not replace the object key.

### Out of scope

A second note on a text item, rich text, a required note, and changing the file or the URL from this field.

### Rules that are easy to get wrong

- `content` stays the URL or the object key. The note is not written into `content`.
- Empty and missing notes are `null`, not `""`.
- Editing the note updates `last_touched_at`. Opening the item does not.
- User B gets 404 when reading or patching A's note.
- The image cap stays 5 MB and the voice cap stays 15 MB.

### Done when

Supertest creates a link, an image, and a voice item with a note, patches the note, and asserts `content` did not change. A blank note is stored as `null`. User B gets 404. The card and the detail view show the note after a reload.

### Confirm

1. Save a link, an image, and a voice clip, each with a short note. See the note on the card and on the detail page. Change the note on the detail page, reload, and see the new words.
2. Edge: save an image with the note left blank, and confirm the card has no extra text. As user B, open user A's item and get 404.

## Next chat

Open a new chat and do **T1** only. Tell that chat to read the T1 section of this file and spec sections 2, 3, 4, and 5. Each later task gets its own chat. Do not start T2 in T1's chat.
