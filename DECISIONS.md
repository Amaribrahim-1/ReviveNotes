# Decisions

## Stack

ReviveNotes keeps a separate Express API in this repo. Postgres is reached only through Prisma. Voice and image bytes go to Cloudflare R2 later, not into Postgres.

Supabase, Firebase, and deploying the API as Vercel serverless were rejected. The API stays one Node service so a future non-browser client can call the same routes.

`dotenv` is installed in the API because Prisma 7 reads `DATABASE_URL` from `prisma.config.ts`, and Node does not load a `.env` file by itself. `tsx` was not added. The API is compiled with `tsc` and started with `node`.

## Schema

Timestamps are `timestamptz` in UTC. Prisma's default `DateTime` is `timestamp` without a time zone, so each timestamp field uses `@db.Timestamptz(3)`. Nothing shifts a stored instant to fake the user's day. "Today" is computed later, at read time, from `timezone` and `day_start_time`. `day_start_time` is an integer hour.

`name_key` is the display name after trim and lowercase. Uniqueness is `(user_id, name_key)`, so one user cannot save both "Work" and "work", and two users can use the same name.

`RefreshSession` is a table in this first migration because the next task stores refresh tokens there. `ReminderDelivery` is a table now so one reminder slot is recorded once per user per local calendar date. `local_date` is a Postgres `date` (`@db.Date`), not a shifted timestamp.

`duration_seconds` is on the item because the voice card shows a duration, and the server will not open the audio file to measure it.

## Session

The browser holds two cookies, `access_token` and `refresh_token`. Both are `httpOnly`, `Secure`, and `SameSite=None`, on path `/`. The access cookie is a JWT that lives 15 minutes. The refresh cookie is a random value that lives 30 days. The database stores only the SHA-256 hash of that random value. bcrypt is for the password. The refresh token is already random, so it is not hashed with bcrypt.

`SameSite=None` is there because the web app and the API are different sites: different ports on your machine, and Vercel plus Render later. The `Secure` flag stays on localhost. Chromium treats `http://localhost` as a secure context, so the cookie still sticks.

Login creates a new `session_id`, so each browser has its own session. Refresh rotation happens only in `POST /auth/refresh`. The new row keeps the same `session_id`, and the old row gets `replaced_at`. The access JWT carries that `session_id`. If a refresh token shows up again after it was replaced or revoked, every row with that `session_id` gets `revoked_at`, and `/me` rejects the access cookie from that browser too. Another browser, with its own `session_id`, stays logged in.

Register and login are limited to 5 attempts per 15 minutes per IP plus email. The counter sits in memory in this process, so it resets when the process restarts. Redis was rejected because it would be a second always-on service.

## Categories and tags

`color` stores one of eight ids from `CATEGORY_COLORS`: `red`, `orange`, `amber`, `green`, `teal`, `blue`, `violet`, `pink`. The screen maps each id to a Tailwind class. A hex color typed by the user was rejected.

A category or tag name is trimmed. `name_key` is that trimmed name in lowercase. Uniqueness is still `(user_id, name_key)`, so one user cannot save both `Work` and `work`, and two users can use the same name.

## Capture

Text content is 1 to 10,000 characters, and a link URL is at most 2,000 characters.

## Day boundary

`day_start_time = 14` and `Africa/Cairo` means the user's day runs from 14:00 until 14:00 the next calendar date, in Cairo. An instant at 13:00 local belongs to the previous calendar date. An instant at 14:00 local belongs to that calendar date.

The database keeps the original UTC instant. The list computes `local_date` when it reads `created_at`, using the timezone and day-start hour saved at that moment. Storing a timestamp already shifted into local time was rejected: if the user later changes the zone or the start hour, the original instant would be gone.

## Item lifecycle

`PATCH /items/:id` accepts `content`, `status`, `category_id`, and `tag_ids`. `tag_ids` is the full set on that item. The screen sends every selected tag in one save. Adding a single tag through its own route was rejected, because the picker would then need a second request to learn what is already selected.

`last_touched_at` moves only when content, status, category, or the tag set actually changes. Sending the same values does not move it. `created_at` stays. Opening the detail page still does not count as a touch.

Entering `done` writes one `done` ClearEvent. A second save that is already `done` does not write another. Leaving `done` deletes that item's `done` events whose `created_at` falls in the current user-day from `getUserDayRange`. Older `done` events stay. Comparing UTC calendar dates was rejected, because Cairo midnight is not UTC midnight. Archive writes no event. Permanent delete writes a `deleted` event first, then deletes the item. Postgres sets that event's `item_id` to null, and the event stays.

Editing a link URL clears `link_preview`, because the old preview described the old URL. Voice and image `content` is a private object key, so this patch refuses to replace it. A free-text rewrite of that key was rejected.

## All-items filters

`GET /items` stays the only list. Optional `category_id`, `status`, and `type` are one value each and combine with AND. Repeated `tag` matches an item that has any of those tags. Omitting `tag` does not filter tags. Omitting `status` returns every status.

A second filtered list route was rejected. The cursor stays `created_at|id` inside that same filtered query, so the next page does not walk outside the filters. Revival is a different list, added below. A category id that belongs to someone else matches no rows for the caller, because every row is also limited to `user_id`.

The all-items screen keeps the chosen filters in Zustand. TanStack Query keeps the item pages. The item array is not copied into Zustand.

## Revival

An item is stale when `status` is `inbox` or `active` and `last_touched_at` is strictly earlier than now minus 7 × 24 hours. A touch at exactly that age stays off the list. `done` and `archived` are never stale. The window is not the user's day, so `day_start_time` and `timezone` are not part of the cutoff. Shifting the cutoff through the day boundary was rejected, because the spec measures 7 × 24 hours from the current instant.

`GET /revival` returns that list for the caller and does not write. It is not `GET /items/:id` and it is not a page of `GET /items`. The all-items screen still uses `GET /items`. Oldest `last_touched_at` is first, then `id`, so the most neglected note is at the top. This task does not paginate.

`POST /items/:id/revive` sets `last_touched_at` to now. `created_at` and `status` stay, so the note does not jump into today. A cron job was rejected because the spec runs this when the app loads, not on a timer.

The signed-in shell asks once per full page load. TanStack Query keeps that result fresh for the whole tab (`staleTime: Infinity`), so a client-side navigation does not ask again. Revive and delete remove the row from that cached list. When the list is empty, the normal page shows. A full reload asks again.

## Voice bytes

A voice clip is stored in Cloudflare R2. The item row keeps the private object key in `content`, shaped like `{user_id}/{item_id}.webm` or `.ogg`. `GET /items/:id/file` loads the row with `id` and `user_id`, then the API streams the bytes. The JSON body and the audio element never get an R2 host.

A public bucket URL was rejected, because anyone with that link could play the clip. Bytes in Postgres were rejected, because the database holds rows, not audio files. Render's disk was rejected, because that disk is wiped when the free service sleeps or restarts. The bucket stays private.
