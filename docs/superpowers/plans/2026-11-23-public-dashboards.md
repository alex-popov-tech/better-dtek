# Public Dashboards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let anyone create a named, server-stored list of addresses with a short permanent URL that anyone with the link can view and edit.

**Architecture:** Each dashboard is one Redis hash (`meta` field plus one field per address) behind a small repository that returns `Result`. JSON routes under `/api/dashboards` expose it. A new page at `/[id]` reuses the existing address components through a dashboard store that calls the API; a localStorage store remembers visited dashboards for a menu on `/`.

**Tech Stack:** SvelteKit 2, Svelte 5 runes, Skeleton UI v2, Tailwind, zod 4, sveltekit-superforms, ioredis (Upstash), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-23-public-dashboards-design.md`

## Global Constraints

- All user-facing text is Ukrainian and lives in `UI_TEXT` in `src/lib/constants/ui-text.ts`. API error `message` strings are Ukrainian.
- Errors use `Result<T, E>` from `src/lib/types/result.ts`; no thrown exceptions across module boundaries.
- Request inputs are validated with zod schemas in `src/lib/schemas/index.ts`.
- `/` and the local address list behave exactly as before, apart from the dashboards menu added in Task 6.
- Dashboard keys never get a TTL.
- Dashboard id: exactly 10 characters of `[a-z0-9]`. Name: 1–60 chars after trim. Label: optional, ≤ 60 chars. Max 20 addresses per dashboard.
- Key prefix: `dashboard:` when `process.env.VERCEL_ENV === 'production'`, otherwise `dashboard-dev:`.
- No Lua scripts, no `WATCH`/`MULTI`. Same-address and name edits are last-writer-wins.
- All dashboard API responses carry `Cache-Control: no-store`.
- Run before each commit: `npm run check && npm run lint && npm run test`. Commits end with the `Co-Authored-By` line used in this repo's session.

## Review Focus

1. A request body that is not valid JSON → 400 `VALIDATION_ERROR`, not a 500. (Task 3)
2. A dashboard name that is only whitespace, or longer than 60 chars → rejected. (Task 1)
3. A hash field holding corrupt JSON → that address is skipped; the dashboard still loads. (Task 2)
4. `dtek-dashboards` in localStorage is corrupt, an old shape, or a future version → empty list, no crash. (Task 4)
5. Top-level URLs that are not ids (`/ABCDEFGHIJ`, `/favicon.ico`, `/abc`) → not matched by the dashboard route. (Task 5)

---

### Task 1: Types, schemas, id and key helpers

**Files:**

- Create: `src/lib/types/dashboard.ts`
- Create: `src/lib/server/dashboards/keys.ts`
- Modify: `src/lib/types/index.ts` (re-export `./dashboard.js`)
- Modify: `src/lib/schemas/index.ts`
- Test: `tests/unit/dashboard-schemas.test.ts`, `tests/unit/dashboard-keys.test.ts`

**Interfaces:**

- Produces (types, `src/lib/types/dashboard.ts`):
  ```ts
  export const DASHBOARD_ID_LENGTH = 10;
  export const DASHBOARD_NAME_MAX = 60;
  export const DASHBOARD_LABEL_MAX = 60;
  export const DASHBOARD_MAX_ADDRESSES = 20;
  export interface DashboardMeta {
  	id: string;
  	name: string;
  	createdAt: number;
  }
  export interface Dashboard extends DashboardMeta {
  	addresses: SavedAddress[];
  }
  export type AddressInput = Omit<SavedAddress, 'id' | 'createdAt'>;
  export type DashboardErrorCode = 'NOT_FOUND' | 'LIMIT_REACHED' | 'STORAGE_ERROR';
  export interface DashboardError {
  	code: DashboardErrorCode;
  	message: string;
  	cause?: unknown;
  }
  ```
- Produces (schemas): `dashboardIdSchema` (regex `/^[a-z0-9]{10}$/`), `dashboardNameSchema` (`z.string().trim().min(1).max(60)`), `dashboardNameBodySchema` (`{ name }`), `dashboardAddressSchema` (`addressFormSchema` with `label` trimmed, ≤ 60, empty string → `undefined`). `addressFormSchema` itself is not changed.
- Produces (`keys.ts`): `generateDashboardId(): string` (uses `crypto.randomInt` per character over the 36-char alphabet), `dashboardKeyPrefix(): string`, `dashboardKey(id: string): string`, `META_FIELD = 'meta'`, `addressField(addressId: string): string` returning `addr:<addressId>`, `isAddressField(field: string): boolean`.

- [ ] **Step 1: Write failing schema tests**

```ts
it('accepts a 10-char lowercase alphanumeric id', () => {
	expect(dashboardIdSchema.safeParse('234hldch72').success).toBe(true);
});
it.each(['ABCDEFGHIJ', 'abc', '234hldch721', 'favicon.ico', '234hldch7-'])(
	'rejects id %s',
	(id) => {
		expect(dashboardIdSchema.safeParse(id).success).toBe(false);
	}
);
it('trims the name', () => {
	expect(dashboardNameSchema.parse('  Геймери ')).toBe('Геймери');
});
it('rejects whitespace-only and 61-char names', () => {
	expect(dashboardNameSchema.safeParse('   ').success).toBe(false);
	expect(dashboardNameSchema.safeParse('а'.repeat(61)).success).toBe(false);
	expect(dashboardNameSchema.safeParse('а'.repeat(60)).success).toBe(true);
});
it('address: rejects 61-char label, turns empty label into undefined', () => {
	const base = { region: 'kem', city: 'м. Київ', street: 'вул. Хрещатик', building: '1' };
	expect(dashboardAddressSchema.safeParse({ ...base, label: 'x'.repeat(61) }).success).toBe(false);
	expect(dashboardAddressSchema.parse({ ...base, label: '' }).label).toBeUndefined();
	expect(dashboardAddressSchema.safeParse({ ...base, region: 'zzz' }).success).toBe(false);
});
```

- [ ] **Step 2: Write failing key tests**

```ts
it('generates ids that match the id schema', () => {
	for (let i = 0; i < 200; i++) expect(generateDashboardId()).toMatch(/^[a-z0-9]{10}$/);
});
it('uses the production prefix only when VERCEL_ENV is production', () => {
	vi.stubEnv('VERCEL_ENV', 'production');
	expect(dashboardKey('234hldch72')).toBe('dashboard:234hldch72');
	vi.stubEnv('VERCEL_ENV', 'preview');
	expect(dashboardKey('234hldch72')).toBe('dashboard-dev:234hldch72');
	vi.unstubAllEnvs();
	expect(dashboardKeyPrefix()).toBe('dashboard-dev:');
});
it('address fields', () => {
	expect(addressField('u1')).toBe('addr:u1');
	expect(isAddressField('addr:u1')).toBe(true);
	expect(isAddressField('meta')).toBe(false);
});
```

- [ ] **Step 3: Run** `npx vitest run tests/unit/dashboard-schemas.test.ts tests/unit/dashboard-keys.test.ts` — expect FAIL (modules missing).
- [ ] **Step 4: Implement** the types, schemas and helpers listed under Interfaces. `dashboardKeyPrefix()` reads `process.env` at call time (not at module load).
- [ ] **Step 5: Run** the same command — expect PASS.
- [ ] **Step 6: Commit** `feat(dashboards): add types, schemas and key helpers`

---

### Task 2: Dashboard repository

**Files:**

- Modify: `src/lib/server/kv/client.ts` (export the existing `getRedis`)
- Create: `src/lib/server/dashboards/repository.ts`
- Test: `tests/unit/dashboard-repository.test.ts`

**Interfaces:**

- Consumes: Task 1 types; `getRedis()` from `$lib/server/kv/client`; key helpers from `./keys`.
- Produces (all return `Promise<Result<T, DashboardError>>`):
  ```ts
  createDashboard(name: string): Result<Dashboard>
  getDashboard(id: string): Result<Dashboard>
  renameDashboard(id: string, name: string): Result<DashboardMeta>
  addDashboardAddress(id: string, input: AddressInput): Result<SavedAddress>
  updateDashboardAddress(id: string, addressId: string, input: AddressInput): Result<SavedAddress>
  removeDashboardAddress(id: string, addressId: string): Result<void>
  ```

Behaviour the tests pin:

- `createDashboard`: `HSETNX key meta <json>`; when it returns 0 (collision) generate a new id and retry, up to 5 attempts, then `STORAGE_ERROR`. Never calls `EXPIRE`.
- `getDashboard`: one `HGETALL`; no `meta` field → `NOT_FOUND`; addresses sorted by `createdAt` ascending; a field whose JSON fails to parse is skipped and logged with `console.error`.
- Every write first checks `HEXISTS key meta`; missing → `NOT_FOUND` and no write command is issued.
- `addDashboardAddress`: `HLEN key` ≥ 21 (meta + 20) → `LIMIT_REACHED`; otherwise server assigns `id = crypto.randomUUID()` and `createdAt = Date.now()`.
- `updateDashboardAddress`: `HGET` the field; missing → `NOT_FOUND`; keeps stored `id` and `createdAt`, replaces the rest.
- `renameDashboard`: reads `meta`, writes it back with the new name and the original `createdAt`.
- `removeDashboardAddress`: `HDEL`; ok even when the field was already gone.
- Any thrown Redis error → `STORAGE_ERROR` with `cause`.

- [ ] **Step 1: Write the failing tests.** Mock `$lib/server/kv/client` with `vi.mock` so `getRedis()` returns an in-memory fake backed by `Map<string, Map<string, string>>` implementing `hsetnx`, `hset`, `hget`, `hgetall`, `hexists`, `hlen`, `hdel`, each a `vi.fn`. One test per behaviour bullet above, plus:

```ts
it('skips a corrupt address field and still returns the dashboard', async () => {
	const created = await createDashboard('Геймери');
	if (!created.ok) throw new Error('setup');
	fake.data.get(dashboardKey(created.value.id))!.set('addr:bad', '{not json');
	const got = await getDashboard(created.value.id);
	expect(got.ok && got.value.addresses).toEqual([]);
});
it('does not create a hash when adding to an unknown dashboard', async () => {
	const res = await addDashboardAddress('zzzzzzzzzz', input);
	expect(!res.ok && res.error.code).toBe('NOT_FOUND');
	expect(fake.hset).not.toHaveBeenCalled();
});
it('rejects the 21st address', async () => {
	/* add 20 → ok, 21st → LIMIT_REACHED */
});
it('retries on id collision', async () => {
	/* hsetnx returns 0 once, then 1 → ok */
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/dashboard-repository.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the six functions.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(dashboards): add Redis repository`

---

### Task 3: API routes

**Files:**

- Modify: `src/lib/server/validate.ts` (add `validateBody`)
- Create: `src/lib/server/dashboards/http.ts`
- Create: `src/routes/api/dashboards/+server.ts` (POST)
- Create: `src/routes/api/dashboards/[id]/+server.ts` (GET, PATCH)
- Create: `src/routes/api/dashboards/[id]/addresses/+server.ts` (POST)
- Create: `src/routes/api/dashboards/[id]/addresses/[addressId]/+server.ts` (PUT, DELETE)
- Modify: `src/lib/constants/ui-text.ts`
- Test: `tests/unit/dashboard-api.test.ts`

**Interfaces:**

- Consumes: Task 2 repository functions; Task 1 schemas.
- Produces: `validateBody<T extends z.ZodType>(request: Request, schema: T): Promise<Result<z.infer<T>, ApiValidationError>>` — same error body shape as `validateQuery`; unparseable JSON yields the same 400 `VALIDATION_ERROR`.
- Produces: `dashboardErrorResponse(error: DashboardError): Response` in `http.ts` — `NOT_FOUND` → 404, `LIMIT_REACHED` → 409, `STORAGE_ERROR` → 503; body `{ error: code, message }`; `STORAGE_ERROR` is also sent to Sentry via `Sentry.captureException` when a `cause` exists.
- Produces the HTTP contract (all with `Cache-Control: no-store`):

| Route                                               | Success             | Errors               |
| --------------------------------------------------- | ------------------- | -------------------- |
| `POST /api/dashboards` `{name}`                     | 201 `Dashboard`     | 400, 503             |
| `GET /api/dashboards/[id]`                          | 200 `Dashboard`     | 404, 503             |
| `PATCH /api/dashboards/[id]` `{name}`               | 200 `DashboardMeta` | 400, 404, 503        |
| `POST /api/dashboards/[id]/addresses`               | 201 `SavedAddress`  | 400, 404, 409, 503   |
| `PUT /api/dashboards/[id]/addresses/[addressId]`    | 200 `SavedAddress`  | 400, 404, 503        |
| `DELETE /api/dashboards/[id]/addresses/[addressId]` | 204 empty           | 404 (dashboard), 503 |

An `[id]` that fails `dashboardIdSchema` → 404 without touching Redis.

UI text to add (used as API messages and later by the client):

```ts
dashboardNotFound: 'Дашборд не знайдено',
dashboardLimitReached: 'У дашборді вже максимум адрес (20)',
dashboardStorageError: 'Не вдалося зберегти зміни. Спробуйте пізніше.',
dashboardNameInvalid: 'Назва має містити від 1 до 60 символів',
```

- [ ] **Step 1: Write failing tests.** `vi.mock('$lib/server/dashboards/repository')`; import the handlers from the `+server.ts` files and call them with `{ request: new Request(...), params }` cast to the handler's event type. Cases:

```ts
it('POST /api/dashboards returns 201 and the dashboard', ...);          // body {name:' Геймери '} → repo called with 'Геймери'
it('POST with invalid JSON body returns 400 VALIDATION_ERROR', ...);     // body: '{oops'
it('POST with whitespace name returns 400', ...);
it('GET unknown id returns 404 NOT_FOUND', ...);
it('GET malformed id returns 404 without calling the repository', ...);  // params.id = 'ABC'
it('POST address at the cap returns 409 LIMIT_REACHED', ...);
it('DELETE address returns 204 with empty body', ...);
it('storage failure returns 503 STORAGE_ERROR', ...);
it('every response has Cache-Control: no-store', ...);
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/dashboard-api.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** `validateBody`, `http.ts`, and the four route files.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** `feat(dashboards): add API routes`

---

### Task 4: Client API and stores

**Files:**

- Modify: `src/lib/types/errors.ts` (add `'NOT_FOUND' | 'LIMIT_REACHED'` to `ApiErrorCode`)
- Create: `src/lib/utils/dashboard-api.ts`
- Create: `src/lib/stores/dashboards.ts` (remembered dashboards)
- Create: `src/lib/stores/dashboard.ts` (one open dashboard)
- Test: `tests/unit/dashboards-store.test.ts`, `tests/unit/dashboard-store.test.ts`

**Interfaces:**

- Consumes: Task 3 HTTP contract; `loadFromStorage` / `saveToStorage` from `$lib/utils/storage`; `apiError`, `ApiError`.
- Produces (`dashboard-api.ts`, each `Promise<Result<T, ApiError>>`, messages from `UI_TEXT`, mapping HTTP 404 → `NOT_FOUND`, 409 → `LIMIT_REACHED`, 400 → `VALIDATION_ERROR`, other non-2xx → `SERVER_ERROR`, fetch throw → `NETWORK_ERROR`):
  ```ts
  createDashboard(name: string): Result<Dashboard>
  fetchDashboard(id: string): Result<Dashboard>
  renameDashboard(id: string, name: string): Result<DashboardMeta>
  addDashboardAddress(id: string, input: AddressInput): Result<SavedAddress>
  updateDashboardAddress(id: string, addressId: string, input: AddressInput): Result<SavedAddress>
  removeDashboardAddress(id: string, addressId: string): Result<void>
  ```
- Produces (`stores/dashboards.ts`):
  ```ts
  export interface RememberedDashboard {
  	id: string;
  	name: string;
  	lastVisitedAt: number;
  }
  export const dashboardsStore: {
  	subscribe: Readable<RememberedDashboard[]>['subscribe']; // sorted by lastVisitedAt desc
  	remember(d: { id: string; name: string }): void; // insert or update name + lastVisitedAt
  	forget(id: string): void;
  };
  ```
  Storage key `dtek-dashboards`, envelope `{ version: 1, data: RememberedDashboard[] }`. Anything that is not exactly that shape with `version === 1` loads as empty. Entries whose `id` fails the id regex are dropped on load.
- Produces (`stores/dashboard.ts`):

  ```ts
  export function createDashboardStore(initial: Dashboard): {
  	subscribe: Readable<Dashboard>['subscribe'];
  	add(input: AddressInput): Promise<Result<void, ApiError>>;
  	update(addressId: string, input: AddressInput): Promise<Result<void, ApiError>>;
  	remove(addressId: string): Promise<Result<void, ApiError>>;
  	rename(name: string): Promise<Result<void, ApiError>>;
  	reload(): Promise<Result<void, ApiError>>;
  };
  ```

  State changes only after the server answers ok (not optimistic). `add` appends the returned address; `rename` also calls `dashboardsStore.remember`.

- [ ] **Step 1: Write failing tests for `dashboardsStore`** (localStorage mocked as in `tests/unit/stores.test.ts`; use `vi.resetModules()` + dynamic import to re-load from storage):

```ts
it('remember adds an entry and persists a version-1 envelope', ...);
it('remember on an existing id updates name and moves it to the top', ...);
it('forget removes the entry', ...);
it.each([
	'not json',
	'[]',
	'{"version":2,"data":[]}',
	'{"version":1,"data":"x"}',
])('loads %s as an empty list', ...);
it('drops entries with a malformed id on load', ...);
```

- [ ] **Step 2: Write failing tests for `createDashboardStore`** with `vi.mock('$lib/utils/dashboard-api')`:

```ts
it('add appends the server-returned address', ...);
it('add leaves state untouched and returns the error on failure', ...);   // LIMIT_REACHED
it('update replaces the matching address', ...);
it('remove drops the address', ...);
it('rename updates the name and remembers it', ...);
it('reload replaces name and addresses with the server copy', ...);
```

- [ ] **Step 3: Run** `npx vitest run tests/unit/dashboards-store.test.ts tests/unit/dashboard-store.test.ts` — expect FAIL.
- [ ] **Step 4: Implement** the API client and both stores.
- [ ] **Step 5: Run** — expect PASS.
- [ ] **Step 6: Commit** `feat(dashboards): add client API and stores`

---

### Task 5: Dashboard page

**Files:**

- Create: `src/params/dashboardId.ts`
- Create: `src/lib/server/address-form.ts`
- Modify: `src/routes/+page.server.ts` (use the shared load/action)
- Create: `src/routes/[id=dashboardId]/+page.server.ts`
- Create: `src/routes/[id=dashboardId]/+page.svelte`
- Create: `src/routes/[id=dashboardId]/+error.svelte`
- Create: `src/lib/components/composite/AddressModal.svelte`
- Modify: `src/routes/+page.svelte` (use `AddressModal`)
- Modify: `src/lib/components/composite/AddressList.svelte`
- Modify: `src/lib/constants/ui-text.ts`
- Test: `tests/unit/dashboard-param.test.ts`

**Interfaces:**

- Consumes: `getDashboard` (Task 2), `createDashboardStore`, `dashboardsStore` (Task 4), `addressStatusStore`, `scheduleCacheStore`, `showError` from `$lib/stores/toast`.
- Produces: `match(param: string): boolean` in `src/params/dashboardId.ts` (delegates to `dashboardIdSchema`).
- Produces: `createAddressForm()` and `addAddressAction` in `src/lib/server/address-form.ts` — the exact logic now in `src/routes/+page.server.ts`, moved so both routes export `actions = { addAddress: addAddressAction }`. `AddressForm` keeps posting to `?/addAddress` and is not changed.
- Produces: `AddressModal.svelte` — the modal markup and focus/Escape handling now inline in `src/routes/+page.svelte` (the `{#if showModal}` block and its helpers), extracted unchanged. Props: `form`, `address?: SavedAddress`, `onsave`, `oncancel`, `ondelete?`.
- Produces: two optional props on `AddressList`: `title?: string` (default `UI_TEXT.savedAddresses`) and `onrefresh?: () => Promise<void>` (default: current `addressStatusStore.refreshAllStatuses(addresses)`).

Page behaviour:

- Server load: `getDashboard(params.id)`; `NOT_FOUND` → `error(404, UI_TEXT.dashboardNotFound)`; `STORAGE_ERROR` → `error(503, UI_TEXT.dashboardStorageError)`; ok → `{ dashboard, form }`. Sets `Cache-Control: no-store` via `setHeaders`.
- `+page.svelte`: builds the store from `data.dashboard`; on mount calls `dashboardsStore.remember({ id, name })`; fetches statuses with the same `$effect` pattern as the home page; add / edit / delete go through the store and call `showError(result.error.message)` on failure, keeping the modal open on a failed save.
- Refresh (button via `onrefresh`, and `PullToRefresh`): `await store.reload()` then `addressStatusStore.refreshAllStatuses(addresses)`.
- Header row above the list: link back to `/` (`UI_TEXT.backToMyAddresses`), a rename button that turns the title into a text input (Enter saves, Escape cancels, max 60), and a copy-link button that writes `location.href` to the clipboard and briefly shows `UI_TEXT.linkCopied`. The list's `title` is the dashboard name.
- `<svelte:head>`: `<title>{name} — {UI_TEXT.appTitle}</title>` and `<meta name="robots" content="noindex" />`.
- `+error.svelte`: shows `page.error.message` and a link home. When `page.status === 404` and the id is in `dashboardsStore`, also shows a `UI_TEXT.forgetDashboard` button that calls `dashboardsStore.forget(page.params.id)`.
- When an address is removed, also drop its expand state: export `clearScheduleExpandState(addressId: string): void` from `src/lib/stores/addresses.ts` and call it after a successful remove.

UI text to add:

```ts
backToMyAddresses: 'Мої адреси',
renameDashboard: 'Перейменувати',
copyLink: 'Копіювати посилання',
linkCopied: 'Посилання скопійовано',
forgetDashboard: 'Прибрати зі списку',
dashboardEmpty: 'У цьому дашборді ще немає адрес',
```

- [ ] **Step 1: Write the failing matcher test**

```ts
it('matches a dashboard id', () => expect(match('234hldch72')).toBe(true));
it.each(['ABCDEFGHIJ', 'favicon.ico', 'abc', 'api', '234hldch721'])('does not match %s', (p) => {
	expect(match(p)).toBe(false);
});
```

- [ ] **Step 2: Run** `npx vitest run tests/unit/dashboard-param.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the matcher; run — expect PASS.
- [ ] **Step 4: Extract** `address-form.ts` and `AddressModal.svelte`; switch the home route to them. Run `npm run check && npm run test` — expect PASS with no behaviour change. Start `npm run dev`, open `/`, add, edit and delete an address — works as before.
- [ ] **Step 5: Add** the `title` / `onrefresh` props to `AddressList` and the UI text.
- [ ] **Step 6: Implement** the dashboard route files and `clearScheduleExpandState`.
- [ ] **Step 7: Verify in the browser** against `npm run dev`:
  - `curl -s -X POST localhost:5173/api/dashboards -H 'content-type: application/json' -d '{"name":"Тест"}'` → note the `id`; open `/<id>`.
  - Add an address → card appears with a traffic light; reload → still there.
  - In a second browser profile open the same URL, add another address; in the first press refresh → both shown.
  - Rename, reload → new name. Copy link → clipboard holds the URL.
  - Open `/zzzzzzzzzz` → not-found page with a link home. Open `/ABCDEFGHIJ` → SvelteKit's normal 404.
- [ ] **Step 8: Run** `npm run check && npm run lint && npm run test` — expect PASS.
- [ ] **Step 9: Commit** `feat(dashboards): add dashboard page`

---

### Task 6: Home page menu

**Files:**

- Create: `src/lib/components/composite/DashboardsMenu.svelte`
- Modify: `src/routes/+page.svelte` (render the menu above `AddressList`)
- Modify: `src/lib/constants/ui-text.ts`

**Interfaces:**

- Consumes: `dashboardsStore` (Task 4), `createDashboard` from `$lib/utils/dashboard-api` (Task 4), `goto` from `$app/navigation`, `showError`.
- Produces: `DashboardsMenu.svelte` with no props.

Behaviour:

- A row with two controls: a "my dashboards" button that toggles a panel, and a "create dashboard" button.
- The panel lists `$dashboardsStore` in store order; each row is a link to `/<id>` showing the name, plus a small button (`aria-label` = `UI_TEXT.forgetDashboard`) that calls `forget(id)`. The "my dashboards" button is not rendered when the list is empty. The panel closes on Escape and on click outside.
- "Create" opens a small dialog with one text input (`maxlength="60"`, required) and submit / cancel. Submit calls `createDashboard(name)`; ok → `dashboardsStore.remember(...)` then `goto('/' + id)`; error → `showError(message)` and the dialog stays open. The submit button is disabled while the request runs.
- Nothing else on `/` changes.

UI text to add:

```ts
myDashboards: 'Мої дашборди',
createDashboard: 'Створити дашборд',
dashboardName: 'Назва дашборду',
dashboardNamePlaceholder: 'Наприклад, Геймери',
create: 'Створити',
```

(Reuse the existing cancel text key if one exists; otherwise add `cancel: 'Скасувати'`.)

- [ ] **Step 1: Implement** the component and render it on the home page.
- [ ] **Step 2: Verify in the browser** against `npm run dev`:
  - Fresh profile: only the create button shows. Create "Геймери" → lands on `/<id>`.
  - Back on `/`: the menu lists "Геймери"; clicking it opens the dashboard.
  - Open a second dashboard URL directly (as if sent by a friend), return to `/` → it is listed first.
  - Forget one → it disappears and stays gone after reload; its URL still works.
  - Phone width (375 px): the row does not overflow, the panel is usable.
  - The saved-addresses list below behaves exactly as before.
- [ ] **Step 3: Run** `npm run check && npm run lint && npm run test` — expect PASS.
- [ ] **Step 4: Commit** `feat(dashboards): add dashboards menu to home page`

---

### Task 7: Docs and final verification

**Files:**

- Modify: `CLAUDE.md` (Architecture: dashboards repository, routes, stores, the `dashboard:` / `dashboard-dev:` key prefixes, "Upstash Redis" instead of "Vercel KV")
- Modify: `README.md` (one short section describing dashboards)
- Modify: `src/lib/types/dtek-cache.ts` (add the dashboard keys to the "Redis Keys" comment)

- [ ] **Step 1: Update** the three files.
- [ ] **Step 2: Run** `npm run check && npm run lint && npm run test && npm run build` — all pass.
- [ ] **Step 3: Check the service worker.** Run `npm run preview`, open a dashboard, edit it from a second profile, reload the first → the edit is visible (the page is not served stale by the PWA cache). If it is stale, exclude dashboard navigations from the service worker's navigation fallback in `vite.config.ts` and re-check.
- [ ] **Step 4: Remove test data:** delete the `dashboard-dev:*` keys created during verification (`redis-cli --scan --pattern 'dashboard-dev:*'`, or a one-off ioredis script).
- [ ] **Step 5: Commit** `docs: describe public dashboards`
- [ ] **Step 6: Track follow-ups** with `bd`: file anything discovered and not done.
