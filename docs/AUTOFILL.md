# Job Agent autofill (Playwright)

## Quick start (button)

1. **Once per session on your Mac:**
   ```bash
   pnpm autofill:daemon
   ```
2. Job Agent → open a pack with a **job URL**
3. Click **Formu otomatik doldur** / **Autofill application form**
4. Chromium opens, fields are filled — **review and submit yourself**

Works with local dev (`localhost:3000`) and deployed Vercel app — daemon always runs on your Mac.

## What the agent does automatically (no Playwright)

- **Every night (deployed):** searches Indeed + Remotive + We Work Remotely + watchlist → creates packs in inbox
- **Button "İlanları şimdi ara":** same search on demand

## CLI (optional)

```bash
node scripts/job-agent-autofill.mjs pack.json "https://jobs.lever.co/..."
```

## Rules

- Manual submit only — never auto-click Submit
- Do not use on Outlier, Alignerr, or gig platforms (blocked in UI)
- LinkedIn Easy Apply often blocks automation — copy/paste instead
- For PDF CV upload, use **Download PDF** from pack detail

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Start autofill service…" | Run `pnpm autofill:daemon` in a terminal |
| Form not filled | Site may use custom widgets — copy from pack |
| No job URL | Add URL when creating pack or from scrape |
