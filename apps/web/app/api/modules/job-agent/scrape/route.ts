import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { scrapeJobUrl, guessRoleFromScrape } from '@/lib/job-agent/scrape'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const url = String(body.url ?? '').trim()
  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 })

  try {
    const scraped = await scrapeJobUrl(url)
    const company = scraped.company ?? ''
    const role = guessRoleFromScrape(scraped.title, scraped.company) || scraped.title || ''
    return NextResponse.json({
      company,
      role,
      jobDescription: scraped.description,
      jobUrl: url,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scrape failed'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
