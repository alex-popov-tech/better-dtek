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

## Architecture

This is a SvelteKit application for tracking DTEK (Ukrainian power company) power outages. Users save addresses and see real-time outage status with traffic light indicators.

### Server-Side DTEK Integration (`src/lib/server/dtek/`)

- **DtekService** - Singleton facade managing session (1hr TTL), caching (10min), and retry logic
- **client.ts** - HTTP client with cookie jar for DTEK API
- **parser.ts** - Cheerio/Acorn parsing of HTML and embedded JavaScript
- **cache.ts** - Simple TTL cache

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
- Cheerio (HTML parsing) + Acorn (JS AST parsing)
- Vitest
- Deployed to Vercel (Frankfurt region)
