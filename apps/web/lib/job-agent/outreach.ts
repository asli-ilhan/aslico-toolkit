import type { SupabaseClient } from '@supabase/supabase-js'
import {
  generateColdOutreachEmail,
  selectOutreachContacts,
  type MasterProfileData,
} from '@aslico/ai'
import { discoverContacts } from './contacts'

interface PackRow {
  id: string
  user_id: string
  company: string
  role: string
  job_url: string | null
  job_description: string | null
  cover_letter: string | null
}

export async function runOutreachPipeline(
  supabase: SupabaseClient,
  userId: string,
  packId: string,
): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY missing')
  }

  const { data: pack, error: packErr } = await supabase
    .from('application_packs')
    .select('id, user_id, company, role, job_url, job_description, cover_letter')
    .eq('id', packId)
    .eq('user_id', userId)
    .single()

  if (packErr || !pack) throw new Error('Pack not found')

  const { data: existing } = await supabase
    .from('outreach_campaigns')
    .select('id, status')
    .eq('pack_id', packId)
    .maybeSingle()

  if (existing && existing.status === 'sent') return

  let campaignId = existing?.id as string | undefined

  if (!campaignId) {
    const { data: created, error: createErr } = await supabase
      .from('outreach_campaigns')
      .insert({
        user_id: userId,
        pack_id: packId,
        status: 'discovering',
      })
      .select('id')
      .single()

    if (createErr) throw createErr
    campaignId = created.id
  } else {
    await supabase
      .from('outreach_campaigns')
      .update({ status: 'discovering', error: null, updated_at: new Date().toISOString() })
      .eq('id', campaignId)
    await supabase.from('outreach_recipients').delete().eq('campaign_id', campaignId)
  }

  try {
    const row = pack as PackRow
    const candidates = await discoverContacts(row.company, row.role, row.job_url)

    const candidateInputs = candidates.map((c) => ({
      name: c.name,
      title: c.title,
      email: c.email,
    }))

    const selected = await selectOutreachContacts(candidateInputs, row.company, row.role)

    if (selected.length === 0) {
      await supabase
        .from('outreach_campaigns')
        .update({
          status: 'failed',
          error: 'No contacts found for this company. Add HUNTER_API_KEY or check job URL.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
      return
    }

    const { data: profileRow } = await supabase
      .from('candidate_profiles')
      .select('master_profile')
      .eq('user_id', userId)
      .maybeSingle()

    const masterProfile = profileRow?.master_profile as MasterProfileData | null
    if (!masterProfile?.summary) {
      await supabase
        .from('outreach_campaigns')
        .update({
          status: 'failed',
          error: 'Master profile required for outreach draft.',
          updated_at: new Date().toISOString(),
        })
        .eq('id', campaignId)
      return
    }

    const { data: gmail } = await supabase
      .from('gmail_connections')
      .select('email')
      .eq('user_id', userId)
      .maybeSingle()

    const draft = await generateColdOutreachEmail(
      masterProfile,
      {
        company: row.company,
        role: row.role,
        jobDescription: row.job_description ?? '',
        jobUrl: row.job_url ?? undefined,
      },
      selected,
      gmail?.email ?? process.env.GMAIL_SENDER_EMAIL ?? undefined,
    )

    await supabase.from('outreach_recipients').insert(
      selected.map((r) => {
        const match = candidates.find((c) => c.email.toLowerCase() === r.email.toLowerCase())
        return {
          campaign_id: campaignId,
          name: r.name,
          title: r.title,
          email: r.email,
          source: match?.source ?? 'discovered',
          relevance_score: match?.confidence ?? 0.5,
          selected: true,
        }
      }),
    )

    await supabase
      .from('outreach_campaigns')
      .update({
        status: 'draft_ready',
        subject: draft.subject,
        body: draft.body,
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)

    await supabase.from('application_events').insert({
      user_id: userId,
      pack_id: packId,
      event_type: 'outreach_draft_ready',
      notes: `${selected.length} recipient(s)`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Outreach pipeline failed'
    await supabase
      .from('outreach_campaigns')
      .update({
        status: 'failed',
        error: message,
        updated_at: new Date().toISOString(),
      })
      .eq('id', campaignId)
    throw err
  }
}

export async function sendApprovedOutreach(
  supabase: SupabaseClient,
  userId: string,
  packId: string,
  subject: string,
  body: string,
): Promise<{ sent: number; failed: string[] }> {
  const { getValidAccessToken, sendGmailMessage } = await import('@/lib/gmail/send')

  const { data: campaign, error: campErr } = await supabase
    .from('outreach_campaigns')
    .select('id, status')
    .eq('pack_id', packId)
    .eq('user_id', userId)
    .single()

  if (campErr || !campaign) throw new Error('Outreach campaign not found')
  if (campaign.status === 'sent') throw new Error('Already sent')

  const { data: recipients, error: recErr } = await supabase
    .from('outreach_recipients')
    .select('id, email, name')
    .eq('campaign_id', campaign.id)
    .eq('selected', true)

  if (recErr) throw recErr
  if (!recipients?.length) throw new Error('No recipients selected')

  const { accessToken, email: fromEmail } = await getValidAccessToken(supabase, userId)

  await supabase
    .from('outreach_campaigns')
    .update({
      status: 'sending',
      subject,
      body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)

  let sent = 0
  const failed: string[] = []

  for (const recipient of recipients) {
    try {
      const personalized = body.replace(/\{name\}/gi, recipient.name?.split(' ')[0] ?? 'there')
      await sendGmailMessage(accessToken, fromEmail, recipient.email, subject, personalized)
      await supabase
        .from('outreach_recipients')
        .update({ sent_at: new Date().toISOString(), error: null })
        .eq('id', recipient.id)
      sent++
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Send failed'
      failed.push(`${recipient.email}: ${msg}`)
      await supabase
        .from('outreach_recipients')
        .update({ error: msg })
        .eq('id', recipient.id)
    }
  }

  const finalStatus = sent > 0 ? 'sent' : 'failed'
  await supabase
    .from('outreach_campaigns')
    .update({
      status: finalStatus,
      subject,
      body,
      sent_at: sent > 0 ? new Date().toISOString() : null,
      error: failed.length > 0 ? failed.join('; ') : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', campaign.id)

  if (sent > 0) {
    await supabase.from('application_events').insert({
      user_id: userId,
      pack_id: packId,
      event_type: 'outreach_sent',
      notes: `${sent} email(s) from ${fromEmail}`,
    })
  }

  return { sent, failed }
}
