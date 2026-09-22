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
