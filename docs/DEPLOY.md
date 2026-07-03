# Deploy (Vercel)

## What runs automatically after deploy

| Feature | Where | When |
|---------|--------|------|
| **Job search** | Vercel Cron → `/api/modules/job-agent/nightly` | Every day **02:00 UTC** |
| **Manual search** | Job Agent → **İlanları şimdi ara** | On button click |
| **Gmail outreach** | Server `.env` | On approve & send |
| **Form autofill** | Your Mac (`pnpm autofill:daemon`) | On **Formu otomatik doldur** |

Playwright cannot run on Vercel serverless — autofill stays on your Mac.

## 1. Push to GitHub

```bash
cd "/Users/aslico/Desktop/asliCo's toolkit"
git init
git add .
git commit -m "Job Agent: auto discovery + autofill button"
# create repo on GitHub, then:
git remote add origin https://github.com/YOU/aslico-toolkit.git
git push -u origin main
```

## 2. Vercel project

1. [vercel.com](https://vercel.com) → **Add New Project** → import repo
2. **Root Directory:** `apps/web`
3. **Framework:** Next.js (auto)

## 3. Environment variables

Copy from `apps/web/.env.local` into Vercel → Settings → Environment Variables:

| Variable | Required |
|----------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ |
| `ALLOWED_EMAIL` | ✓ |
| `NEXT_PUBLIC_ALLOWED_EMAIL` | ✓ |
| `ANTHROPIC_API_KEY` | ✓ |
| `GOOGLE_CLIENT_ID` | outreach |
| `GOOGLE_CLIENT_SECRET` | outreach |
| `GMAIL_REFRESH_TOKEN` | outreach |
| `GMAIL_SENDER_EMAIL` | outreach |
| `HUNTER_API_KEY` | optional |
| `ADZUNA_APP_ID` | job discovery (Indeed/Glassdoor agg.) |
| `ADZUNA_APP_KEY` | job discovery |
| `JOOBLE_API_KEY` | job discovery (LinkedIn/Indeed agg.) |
| `FINDWORK_API_KEY` | optional dev jobs |
| `CRON_SECRET` | ✓ for cron (random string) |
| `NEXT_PUBLIC_APP_URL` | `https://your-app.vercel.app` |

Add Google OAuth redirect for production:

```
https://your-app.vercel.app/api/auth/gmail/callback
```

## 4. Cron

`apps/web/vercel.json` already defines nightly cron. Set `CRON_SECRET` in Vercel; cron sends `Authorization: Bearer <CRON_SECRET>`.

Vercel **Pro** recommended for 300s function timeout (nightly uses Claude for up to 5 packs).

## 5. Supabase SQL

Run in Supabase SQL Editor (once):

- `packages/storage/sql/job_agent_v2.sql`
- `packages/storage/sql/job_agent_v3.sql`
- `packages/storage/sql/job_agent_v4_outreach.sql`

## 6. Local autofill (your Mac)

While applying to jobs from the deployed site:

```bash
pnpm autofill:daemon
```

Keep terminal open. In Job Agent pack → **Formu otomatik doldur**.

## Deploy CLI (alternative)

```bash
cd apps/web
npx vercel --prod
```

Follow prompts, set root to `apps/web`, add env vars in dashboard after first deploy.
