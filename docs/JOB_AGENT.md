# Job Agent v2 + v3

## Setup

Run in Supabase SQL Editor (paste file contents, not paths):

1. `packages/storage/sql/job_agent_v2.sql`
2. `packages/storage/sql/job_agent_v3.sql`
3. `packages/storage/sql/job_agent_v4_outreach.sql`

## Daily loop

1. **Profile** — paste CVs and cover letters → Build master profile (+ research / industry / gig variants)
2. **Preferences** — domains, blocklist, keywords, min fit, nightly toggle
3. **Watchlist** — job URLs and RSS feeds for nightly scan
4. **Add job** — paste listing or scrape URL → pack in **Morning inbox**
5. **Morning inbox** — edit CV/letter, notes, deadline, email draft, approve or mark submitted
6. **History** — funnel stages (applied → interview → offer)
7. **Analytics** — conversion funnel, deadlines, follow-ups

## Nightly discovery

- **Manual:** Preferences → Run nightly now
- **Cron:** set `CRON_SECRET` in env, deploy with `vercel.json` (02:00 UTC) or call:

```bash
curl -X POST https://your-app.vercel.app/api/modules/job-agent/nightly \
  -H "Authorization: Bearer $CRON_SECRET"
```

Scans **30+ sources** (RemoteOK, Remotive, Jobicy, WWR, Built In, Himalayas, The Muse, Working Nomads, SkipTheDrive, Landing.jobs, Arbeitnow, …) plus your watchlist. Skips duplicates and jobs already submitted or in inbox. Creates up to **10 packs** per run.

### Indeed / LinkedIn / Glassdoor

These sites **block direct RSS** from cloud servers (403/429). Use official aggregators (free tiers):

| Env | Covers | Sign up |
|-----|--------|---------|
| `ADZUNA_APP_ID` + `ADZUNA_APP_KEY` | Indeed, Glassdoor, Monster (US/UK/DE/CA/AU) | [developer.adzuna.com](https://developer.adzuna.com) |
| `JOOBLE_API_KEY` | LinkedIn, Indeed, Glassdoor + 70 boards | [jooble.org/api/about](https://jooble.org/api/about) |
| `FINDWORK_API_KEY` | Developer jobs | [findwork.dev/developers](https://findwork.dev/developers) |

Add keys to Vercel → Environment Variables and redeploy.

## Exports

From inbox/history pack detail:

- **Download PDF** — real `.pdf` file (pdf-lib)
- **Print** — print-friendly HTML in browser
- **Download MD** — markdown bundle
- **Autofill JSON** — for Playwright script (`docs/AUTOFILL.md`)
- **Add to calendar** — `.ics` for deadline or follow-up (Apple/Google Calendar)

## Manual job URLs

LinkedIn has no public API; paste listing URLs in **Watchlist** or use Jooble/Adzuna keys above.

## Cold outreach (v4)

When you **mark submitted**, the agent:

1. Discovers contacts (company domain, public pages, optional Hunter.io)
2. Picks up to 3 relevant people (recruiter, hiring manager, talent)
3. Writes a cold outreach email draft

You **approve the email content** in the **Outreach** tab (or History pack detail), then click **Approve & send**. Mail goes from your connected Gmail.

### Gmail setup

1. [Google Cloud Console](https://console.cloud.google.com/) → create project → enable **Gmail API**
2. OAuth consent screen (External, add your email as test user)
3. Credentials → OAuth client (Web) → redirect URI:
   - `http://localhost:3000/api/auth/gmail/callback`
   - `https://your-domain.com/api/auth/gmail/callback`
4. Add to `apps/web/.env.local`:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
5. Job Agent → **Preferences** or **Outreach** → **Connect Gmail**

Optional: `HUNTER_API_KEY` for better contact discovery.

## Gig platform guard

Outlier, Alignerr, etc. get `auto_submit_blocked`. Mark submitted is disabled; copy and apply manually.

## AI pipeline

1. Domain fit boost (maritime, offshore, wind, ML, etc.)
2. Claude fit score + reason
3. Evidence select → CV → letter → humanize
4. Optional email draft generation
