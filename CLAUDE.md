# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

- `npm run dev` - Start development server
- `npm run build` - Production build
- `npm run preview` - Preview production build

### Testing

- `npm run test` - Run unit tests (Vitest)
- `npm run test:watch` - Unit tests in watch mode

### Code Quality

- `npm run check` - Svelte type checking
- `npm run lint` - ESLint
- `npm run lint:fix` - ESLint with auto-fix
- `npm run format` - Prettier formatting

## Issue Tracking

This project uses **bd** (beads) for issue tracking. Run `bd onboard` to get started.

### Quick Reference

- `bd ready` - Find available work
- `bd show <id>` - View issue details
- `bd update <id> --status in_progress` - Claim work
- `bd close <id>` - Complete work
- `bd sync` - Sync with git

### Session Completion

When ending a work session, complete ALL steps:

1. **File issues** - Create issues for remaining/follow-up work
2. **Run quality gates** - Tests, linters, builds (if code changed)
3. **Update issues** - Close finished work, update in-progress items
4. **Clean up** - Clear stashes, prune remote branches
5. **Verify** - All changes committed
6. **Hand off** - Provide context for next session

## Architecture

This is a SvelteKit application for tracking DTEK (Ukrainian power company) power outages. Users save addresses and see real-time outage status with traffic light indicators.

### Server-Side DTEK Integration (`src/lib/server/dtek/`)

- **DtekService** - Facade reading from Vercel KV (data refreshed by GitHub Action every 20min)
- **client.ts** - HTTP client with cookie jar for real-time building status
- **cache.ts** - Simple TTL cache for status responses

### Data Pipeline (`scripts/`, `.github/workflows/`)

- **refresh-dtek-data.ts** - Playwright script extracts DTEK data, stores in Vercel KV
- **refresh-dtek-data.yml** - GitHub Action runs extraction every 20 minutes

### Client-Side Stores (`src/lib/stores/`)

- **addressesStore** - Saved addresses persisted to localStorage
- **addressStatusStore** - Building status cache (5min TTL) with loading states
- **scheduleCacheStore** - Global schedule data by group ID
- **citiesStore** - Available cities
- **theme** - Dark/light mode

### Component Pattern (`src/lib/components/`)

- **atomic/** - Reusable UI components (Select, TrafficLight, ScheduleList)
- **composite/** - Feature components (AddressList, AddressCard, AddressForm)
- **layout/** - AppShell, ThemeToggle

### API Routes (`src/routes/api/`)

- `GET /api/cities` - List all cities
- `GET /api/streets?city=` - Streets for a city
- `GET /api/status?city=&street=` - Building statuses with schedules

## Key Patterns

### Error Handling

Uses `Result<T, E>` type for explicit error handling instead of exceptions. See `src/lib/types/result.ts`.

### UI Language

All UI text is in Ukrainian. Constants are in `src/lib/constants/ui-text.ts`.

## Tech Stack

- SvelteKit + Svelte 5
- Tailwind CSS + Skeleton Labs UI
- Vercel KV (Redis) for cached DTEK data
- Playwright (data extraction in GitHub Actions)
- Vitest
- Deployed to Vercel (Frankfurt region)
