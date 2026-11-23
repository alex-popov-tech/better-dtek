# Public dashboards — design

Date: 2026-11-23

## Intent

The app is used mostly by the owner and a group of friends to plan gaming
sessions around power outages. Today each person re-enters the same set of
addresses on every phone, desktop and tablet, because addresses live only in
that browser's localStorage. With several people and several devices each, the
re-entry multiplies.

A public dashboard is a named, server-stored list of addresses with a short
permanent URL. Enter the addresses once, share the link, and every device that
opens it sees the same list.

## Goals

- Any visitor can create a dashboard by giving it a name, and gets a URL like
  `https://dtek.oleksandrp.com/234hldch72`.
- Anyone who has the URL can add, edit and remove addresses and rename the
  dashboard. The URL is the only key.
- A dashboard page shows the same cards, traffic lights and schedules as the
  home page.
- Each device remembers dashboards it has opened (created there or reached by
  a friend's link) and offers them in a dropdown on `/`.
- `/` and the personal localStorage address list keep working exactly as now.

## Non-goals

- Accounts, logins, passwords, ownership, per-user permissions.
- Deleting a dashboard (nobody can; unused ones just stay).
- Live push of other people's edits (they appear on reload / refresh).
- Pre-filling a new dashboard from the device's local addresses.
- Rate limiting or abuse protection beyond the size caps below.
- Sharing schedule expand/collapse state between devices.

## Anti-goals

- Changing how the home page or the local address list behaves, apart from the
  two new controls.
- One person's change to one address wiping out another person's change to a
  different address (which a "send the whole list" design would do). Two
  people editing the _same_ address or the name is last-writer-wins, by
  design; no versioning or conflict UI.
- Dashboards disappearing: no TTL, and the Redis database must keep eviction
  off.

## Constraints

- SvelteKit + Svelte 5, Skeleton UI, Tailwind; deployed on Vercel (fra1).
- All UI text is Ukrainian and lives in `src/lib/constants/ui-text.ts`.
- Errors use `Result<T, E>` (`src/lib/types/result.ts`), not exceptions.
- Inputs are validated with zod schemas in `src/lib/schemas/index.ts`.
- Storage is the existing Redis behind `REDIS_URL`, accessed through `ioredis`
  (`src/lib/server/kv/client.ts`). As of 2026-11-23 this is an Upstash Redis
  database (moved from Redis Cloud for durability). The scraper's keys
  (`dtek:data:<region>`, 24 h TTL) share the database.

## Approaches considered

1. **One Redis hash per dashboard (chosen).** Each address is its own hash
   field, so adds and removes are one atomic command and edits to different
   addresses cannot overwrite each other. One `HGETALL` reads the whole dashboard.
   Trade-off: the address cap is checked with a separate command, so
   simultaneous adds can overshoot it by one or two. Accepted.
2. **One JSON string per dashboard.** Same format as the scraper data, but
   each edit is read-modify-write and needs a Lua script or `WATCH`/`MULTI`
   with retries to avoid lost updates. More code for what the hash gives free.
3. **Client sends the whole list.** Least code, but last writer wins and
   clobbers others' edits. Rejected: violates an anti-goal.

The owner picked approach 1.

## Design

### Data in Redis

Key `dashboard:<id>`, type hash, no TTL.

| Field         | Value (JSON string)                                                                                      |
| ------------- | -------------------------------------------------------------------------------------------------------- |
| `meta`        | `{ "name": string, "createdAt": number }`                                                                |
| `addr:<uuid>` | `{ "id", "region", "city", "street", "building", "label"?, "createdAt" }` — same shape as `SavedAddress` |

- `<id>`: 10 characters from `[a-z0-9]`, generated server-side with a
  cryptographic random source. Created with `HSETNX` on `meta`; on collision,
  generate again.
- Address `id` (UUID) and `createdAt` are assigned by the server.
- Addresses are returned sorted by `createdAt` ascending.
- A write to a dashboard whose `meta` field does not exist returns 404 and
  must not create the hash.
- Editing an address is check-then-write (it must 404 when missing and keep
  the stored `createdAt`). The tiny window in which an address deleted by
  someone else could be re-created by a simultaneous edit is accepted, like
  the cap overshoot. No Lua scripts or transactions.
- Key prefix depends on environment: `dashboard:` in the Vercel production
  deployment, `dashboard-dev:` everywhere else (local dev and previews).
  Local `.env` points at the production database, so this keeps test
  dashboards out of the real key space.

### Limits

- Dashboard name: 1–60 characters after trimming.
- Address label: optional, up to 60 characters.
- At most 20 addresses per dashboard (checked with `HLEN` before an add).
  Expected real size is 5–10. The cap is kept low because each address
  triggers its own `/api/status` call, which can mean a live request to DTEK;
  20 keeps bursts small without changing the status store.

### API

Same style as the existing routes: JSON, zod validation, Ukrainian error
messages, `{ error, message }` error bodies, `Cache-Control: no-store`.

| Method and path                                     | Body           | Result                                              |
| --------------------------------------------------- | -------------- | --------------------------------------------------- |
| `POST /api/dashboards`                              | `{ name }`     | 201 `{ id, name, createdAt, addresses: [] }`        |
| `GET /api/dashboards/[id]`                          | —              | 200 `{ id, name, createdAt, addresses }` or 404     |
| `PATCH /api/dashboards/[id]`                        | `{ name }`     | 200 updated dashboard meta                          |
| `POST /api/dashboards/[id]/addresses`               | address fields | 201 the stored address; 409 when the cap is reached |
| `PUT /api/dashboards/[id]/addresses/[addressId]`    | address fields | 200 the stored address; 404 if missing              |
| `DELETE /api/dashboards/[id]/addresses/[addressId]` | —              | 204 (also when already gone)                        |

Address fields are validated with the existing `addressFormSchema` (plus the
label length cap). Addresses are not checked against DTEK's city/street lists,
matching how the local list works.

### Server code

- A dashboard repository next to the KV client (`src/lib/server/`), reusing
  the same lazy Redis connection, returning `Result`.
- Zod schemas for dashboard id, name and request bodies in
  `src/lib/schemas/index.ts`; shared types in `src/lib/types/`.

### Dashboard page

- Route `src/routes/[id]/` with a param matcher that accepts only the id
  format (10 chars of `[a-z0-9]`), so future top-level pages are not captured.
- The server load reads the dashboard and returns it with the page; an unknown
  id renders a "dashboard not found" page with a link home and a button that
  removes the entry from this device's remembered list.
- The page reuses `AddressList`, `AddressCard` and `AddressForm` unchanged in
  appearance. A dashboard store exposes the same add / update / remove
  operations as `addressesStore` but calls the API, and updates its state from
  the server's response (not optimistically). Failures show a toast via the
  existing toast store.
- Above the list: a link back to `/`, the dashboard name with an inline
  rename control, and a "copy link" button.
- Statuses and schedules come from the existing `addressStatusStore`, keyed by
  address id, unchanged.
- Refresh (button and pull-to-refresh) reloads the dashboard's address list
  and then the statuses, so friends' edits show up.
- Schedule expand/collapse state stays per device, using the existing
  per-address-id mechanism in `src/lib/stores/addresses.ts`.

### Home page

Two new controls above the existing address list; nothing else changes.

- **Create dashboard** button: asks for a name, calls the API, navigates to
  the new dashboard.
- **My dashboards** dropdown: lists dashboards this device has opened, most
  recently visited first; choosing one navigates to it. Each entry can be
  forgotten (local only). Hidden when the list is empty.

```
/  (home)                              /234hldch72  (dashboard)
[Мої дашборди ▾] [+ Дашборд]           ← Мої адреси
Збережені адреси  [↻] [+]              Геймери ✎            [Копіювати]
┌ 🟢 Дім · Хрещатик 1      ✎ 🗑 ┐                          [↻] [+ Адреса]
└──────────────────────────────┘      ┌ 🟢 Сашко · Хрещатик 1    ✎ 🗑 ┐
                                       ┌ 🔴 Діма · Педагогічна 25 ✎ 🗑 ┐
```

### Remembered dashboards

- localStorage key `dtek-dashboards`, versioned envelope like the addresses
  store: `{ version: 1, data: [{ id, name, lastVisitedAt }] }`.
- Opening a dashboard page successfully adds or updates its entry (name is
  refreshed from the server, so renames propagate on next visit).

## Calls made by the designer (not decided by the owner)

- The API shape, status codes, and the non-optimistic update style.
- Id alphabet and length (taken from the owner's example URL).
- The exact caps (60 / 60 / 20).
- Last-writer-wins on the same address and on the name; accepted edit/delete
  race.
- Environment-dependent key prefix.
- No rate limiting.
- Sort order of addresses and of the dropdown.
- Shared labels: an address's label is stored in the dashboard and seen by all.

## Storage facts checked on 2026-11-23

- Upstash persists data to disk. The database reports 64 MB max, 2.1 MB used
  (all of it scraper data), policy `optimistic-volatile`. A dashboard is a
  few KB, so memory pressure is not a realistic risk; the owner should still
  keep the "Eviction" toggle off in the Upstash console.

## Left to the builder

- `noindex` on dashboard pages; an `onrefresh` hook on `AddressList` (its
  refresh button currently calls the status store directly); a separate
  label-capped schema so the home form is untouched; telling a Redis failure
  apart from "not found".

- File and component names; whether the dropdown and create dialog are new
  components or inline.
- How `AddressForm`'s superforms validation is wired on the new route (the
  current form posts to the `addAddress` action on `/`).
- Whether dashboard-address expand state is cleaned from localStorage when an
  address is removed.
- Confirming dashboard URLs are not served stale by the PWA service worker.
- Test layout. Expected coverage: the repository (with Redis mocked), the new
  schemas, id generation, and the remembered-dashboards store, in the existing
  Vitest unit style.
