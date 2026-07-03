import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { packToPdf, packToIcs } from '@/lib/job-agent/pdf'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('application_packs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })

  const format = request.nextUrl.searchParams.get('format') ?? 'html'
  const { packToMarkdown, packToPrintHtml, packToAutofillJson } = await import(
    '@/lib/job-agent/export'
  )
  const safeName = `${data.company}-${data.role}`.replace(/[^a-z0-9-_]/gi, '_').slice(0, 60)

  if (format === 'pdf') {
    const bytes = await packToPdf(data)
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}.pdf"`,
      },
    })
  }

  if (format === 'ics') {
    const kind = (request.nextUrl.searchParams.get('kind') ?? 'followup') as
      | 'deadline'
      | 'followup'
      | 'interview'
    const ics = packToIcs(data, kind)
    if (!ics) {
      return NextResponse.json({ error: 'No date set for this event type' }, { status: 400 })
    }
    return new NextResponse(ics, {
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}-${kind}.ics"`,
      },
    })
  }

  if (format === 'md') {
    const md = packToMarkdown(data)
    return new NextResponse(md, {
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        'Content-Disposition': `attachment; filename="${safeName}.md"`,
      },
    })
  }

  if (format === 'autofill') {
    return NextResponse.json(packToAutofillJson(data))
  }

  const html = packToPrintHtml(data)
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  })
}
