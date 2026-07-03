import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isMissingTravelScoutTable } from '@/lib/supabase/errors'

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const row = {
    user_id: user.id,
    ...(Array.isArray(body.preferred_vibes) ? { preferred_vibes: body.preferred_vibes } : {}),
    ...(Array.isArray(body.interests) ? { interests: body.interests } : {}),
    ...(typeof body.avoid_mass_tourism === 'boolean' ?
      { avoid_mass_tourism: body.avoid_mass_tourism }
    : {}),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('travel_scout_settings')
    .upsert(row, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) {
    if (isMissingTravelScoutTable(error)) {
      return NextResponse.json({ error: 'travel_scout_table_missing' }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ settings: data })
}
