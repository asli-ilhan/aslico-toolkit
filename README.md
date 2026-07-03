# asliCo Toolkit

Your personal AI-powered digital studio — modular agents for productivity, learning, and life.

## Stack

- **Monorepo:** Turborepo + pnpm
- **Web:** Next.js 15, React 19, Tailwind CSS 4
- **Canvas:** p5.js background + React Three Fiber voice orb
- **Packages:** `@aslico/core`, `@aslico/ui`, `@aslico/ai`, `@aslico/storage`
- **DB:** PostgreSQL via Drizzle ORM (Supabase-ready)

## Prerequisites

- Node.js 20+
- pnpm 9+

## Setup

```bash
pnpm install
cp .env.example apps/web/.env.local
# Edit apps/web/.env.local with your Supabase keys
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000)

### Passkey auth (Supabase)

See **[docs/AUTH_SETUP.md](docs/AUTH_SETUP.md)** for Dashboard configuration.

Quick flow:
1. Enable **Authentication → Passkeys** in Supabase Dashboard
2. Set RP ID to `localhost`, origin to `http://localhost:3000`
3. First login via **magic link** (email), then register passkey at `/account/passkeys`
4. Future logins: **Passkey** on `/login`

## Project structure

```
apps/web          → Next.js shell (dashboard, modules, auth)
apps/worker       → Background job processor (stub)
packages/core     → Module SDK, event bus, config
packages/ai       → LLM / RAG engine (stub)
packages/storage  → Drizzle schema
packages/ui       → Themes, tokens, primitives
packages/modules  → Plugin modules (_template)
```

## Modules

| Module | Status |
|--------|--------|
| **Transcription** | Beta — [docs/TRANSCRIPTION.md](docs/TRANSCRIPTION.md) |
| **Job Agent** | Beta — [docs/JOB_AGENT.md](docs/JOB_AGENT.md) |
| Doc Editor, Calendar, Voice Assistant | Coming soon |
| Daily Newsletter, Culture Tracker, Language Tutor | Coming soon |

## Adding a new module

Copy `packages/modules/_template` and follow its README. Register in `apps/web/lib/module-registry.ts`.

## Deploy

- **Web:** Vercel (connect repo, set env vars)
- **DB:** Supabase (run `pnpm --filter @aslico/storage db:push`)
- **Worker:** Railway or Fly.io (Phase 1+)

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all apps in dev mode |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Type-check all packages |
