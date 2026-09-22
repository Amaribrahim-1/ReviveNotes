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
