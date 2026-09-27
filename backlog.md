# ReviveNotes backlog

Polish tasks after the MVP. One task is one chat. Do them in order. `tasks.md` is the finished MVP history; open it only if a task below points at it.

Each task that changes spec behavior records the choice in `DECISIONS.md`.

If time slips, skip from the end: T24, then T22.

| ID | Title | Depends on |
| --- | --- | --- |
| T16 | Stay signed in and Egypt time | None |
| T17 | Auto text direction and hidden tags | None |
| T18 | Logo, app icon, and nav bar | T16 |
| T19 | Board with pinned sticky notes | T17, T18 |
| T20 | Delete from the card with a confirm modal | T19 |
| T21 | Real voice player | T19 |
| T22 | Real progress bar | T18 |
| T23 | Better link preview | None |

## T16 — Stay signed in and Egypt time

**Do**
- `/`, `/login`, and `/register` call `/me` on load. If a session exists, go straight to `/inbox`. If not, show the page as it is today.
- Manifest `start_url` becomes `/inbox` ([apps/web/src/app/manifest.ts](apps/web/src/app/manifest.ts)).
- Register sends `Africa/Cairo` instead of the browser timezone.
- Remove the timezone select from [SettingsForm.tsx](apps/web/src/app/settings/SettingsForm.tsx). The day-start hour stays.
- One Prisma migration with `UPDATE` sets every existing user's `timezone` to `Africa/Cairo`.

**Watch**
- The API does not change. It still accepts `timezone`, so another client could send a different one later.
- No flash of the landing page's login buttons while `/me` is loading: show a short loading line instead.

**Confirm**
1. Log in, close the tab, open `/` again. You land on `/inbox` with no login screen.
2. Edge: log out, open `/`. The landing page with login and register shows. Settings has no timezone select, and the day label still follows Cairo.

## T17 — Auto text direction and hidden tags

**Do**
- Add `dir="auto"` to every `input` and `textarea` that takes words (text capture, note, content edit, category name) and to user text shown on cards and the detail page. The first strong letter decides the direction.
- URL fields and URL text stay `dir="ltr"`.
- Hide tags from the UI only: the tag picker on detail, the tag filter on all items, and the tag section on the categories page.

**Watch**
- Tags stay in the database, the API, and the tests. Only the screens hide them.
- `dir="auto"` goes on the element that holds the user's text, not on the whole page. The page stays `rtl` for Arabic UI and `ltr` for English UI.

**Confirm**
1. Type `ماب training` in a text note. It starts from the right and `ماب` stays first. Type `training ماب`. It starts from the left.
2. Edge: an existing item that had tags still opens fine, and no tag UI shows anywhere.

## T18 — Logo, app icon, and nav bar

**Do**
- One SVG logo: a sticky note with a pin. Use it in the nav bar, as the favicon, and for `icon-192.png` and `icon-512.png`. Manifest colors match the theme.
- Nav bar at the top on desktop and a tab bar at the bottom on mobile. Each link has an icon plus its label.
- Theme, language, and logout become icon buttons, each with an `aria-label`.
- Check current Next.js docs for the app icon file conventions before placing files.

**Watch**
- Ask before adding `lucide-react`: it gives ready SVG icons as React components. If the answer is no, write the few icons as inline SVG.
- Remove the unused starter files `next.svg` and `globe.svg`.

**Confirm**
1. Desktop: the top bar shows the logo and icon links. Mobile width: the tab bar sits at the bottom. The browser tab shows the new icon.
2. Edge: with a screen reader or the accessibility tree, every icon-only button reads a name.

## T19 — Board with pinned sticky notes

**Do**
- Inbox, all items, and the revival screen show items as a board: 1 column on mobile (normal scroll), 2 on `md`, 3 on `lg`, 4 on `xl`.
- Each card is a sticky note: paper color, a slight tilt from fixed classes (`rotate-1`, `-rotate-1`, and so on, picked by list index), a shadow, and a pin at the top.
- Each type has its own look: text is yellow; link has a distinct color and keeps its preview; image is a pinned polaroid; voice has its own color.
- The day label spans the full row (`col-span-full`).

**Watch**
- Newest first stays the order. Pagination and "load more" stay.
- Tailwind classes only, no `style={{}}`. One component per file.
- Tilt must not hurt readability: keep it at 1–2 degrees, and turn it off with `motion-reduce:`.

**Confirm**
1. Inbox with a text, a link, an image, and a voice item: four different pinned notes, several per row on desktop.
2. Edge: at mobile width they stack in one column. The image note no longer looks out of place.

## T20 — Delete from the card with a confirm modal

**Do**
- A delete icon button on every sticky note. Pressing it does not open the detail page.
- A confirm modal built on the native `<dialog>` element. Confirm calls the existing `DELETE /items/:id`.
- After delete, invalidate `items`, `progress`, and `revival`.
- The detail page delete uses the same modal.

**Watch**
- Esc and Cancel close the modal and delete nothing. Focus returns to the button that opened it.
- The button has an `aria-label` and a visible focus ring.

**Confirm**
1. Press delete on a card, confirm. The note leaves the board. If it was done today, the progress count drops by 1.
2. Edge: press delete, then Esc. The note stays.

## T21 — Real voice player

**Do**
- On the card and the detail page: play/pause, a seek bar, elapsed / total time, and decorative wave bars that fill as it plays.
- Keep loading the blob with `credentials: "include"` and revoke the object URL when it unmounts.

**Watch**
- The wave bars are a fixed shape. No audio analysis, no new library.
- Playing is not a touch. The play control does not open the detail page.
- Digits stay Western.

**Confirm**
1. Play a voice note on the card, pause, drag the seek bar, resume from there.
2. Edge: play it, open the detail page, play again. After returning, `last_touched_at` did not change (revival order is the same).

## T22 — Real progress bar

**Do**
- `GET /progress/today` returns `{ cleared, open }`. `open` is the count of items whose status is `inbox` or `active` right now. `cleared` stays as today.
- Update the shared schema in `packages/shared`.
- The shell shows a `<progress>` bar with the value `cleared` out of `cleared + open`, and a label like `3 من 10`.

**Watch**
- `archived` is not counted as open.
- A deleted item counts nowhere, as if it never existed (see "Daily progress count" in `DECISIONS.md`). The user wants the total to be the notes that exist, for example `1 من 4` when 4 notes exist and 1 is done. Ask how an archived note should count before building.
- When both are 0, show an empty bar with a short line, not a division by zero.
- User B's counts never include user A's items. Update the progress tests.

**Confirm**
1. Mark one item done: the bar grows and the label changes, for example `1 من 5` to `2 من 5`.
2. Edge: archive an open item: `open` drops by 1 and `cleared` stays.

## T23 — Better link preview

**Do**
- First diagnose: fetch a LeetCode problem URL with `curl` and see whether the site refuses the request or the page has no `og:` tags.
- Add fallbacks when `og:` tags are missing: `<title>`, `meta name="description"`, and `twitter:*` tags. The site name falls back to the hostname.
- Send a browser-like `user-agent`.
- If the site refuses the fetch, the card shows the hostname and the URL cleanly.

**Watch**
- The SSRF guard in [apps/api/src/link-preview.ts](apps/api/src/link-preview.ts) stays as it is: same address checks, timeout, size cap, and redirect limit.
- No scraping package.
- Add tests for each fallback using fixed HTML, not live sites.

**Confirm**
1. Save a LeetCode link: the card shows a title (or at least the hostname) instead of a bare URL.
2. Edge: `http://127.0.0.1/` is still saved with no preview.
