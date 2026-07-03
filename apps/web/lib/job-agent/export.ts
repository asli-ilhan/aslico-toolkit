import type { ApplicationPack } from '@/components/modules/job-agent/types'

export function packToMarkdown(pack: ApplicationPack): string {
  const lines = [
    `# ${pack.company} · ${pack.role}`,
    '',
    pack.job_url ? `URL: ${pack.job_url}` : '',
    pack.fit_score != null ? `Fit: ${Math.round(pack.fit_score)}%` : '',
    pack.fit_reason ? `Reason: ${pack.fit_reason}` : '',
    '',
    '## Cover letter',
    '',
    pack.cover_letter ?? '',
    '',
    '## Tailored CV',
    '',
    pack.tailored_cv ?? '',
  ]
  return lines.filter((l) => l !== undefined).join('\n')
}

export function packToPrintHtml(pack: ApplicationPack): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${esc(pack.company)} - ${esc(pack.role)}</title>
<style>
  body { font-family: Georgia, serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; color: #1c1917; }
  h1 { font-size: 1.25rem; color: #ea580c; border-bottom: 2px solid #fdba74; padding-bottom: 0.5rem; }
  h2 { font-size: 1rem; margin-top: 2rem; color: #c2410c; }
  pre { white-space: pre-wrap; font-family: inherit; line-height: 1.55; font-size: 0.95rem; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>${esc(pack.company)} · ${esc(pack.role)}</h1>
${pack.job_url ? `<p><small>${esc(pack.job_url)}</small></p>` : ''}
<h2>Cover letter</h2>
<pre>${esc(pack.cover_letter ?? '')}</pre>
<h2>Tailored CV</h2>
<pre>${esc(pack.tailored_cv ?? '')}</pre>
</body></html>`
}

export function packToAutofillJson(pack: ApplicationPack): Record<string, string> {
  return {
    company: pack.company,
    role: pack.role,
    jobUrl: pack.job_url ?? '',
    coverLetter: pack.cover_letter ?? '',
    cv: pack.tailored_cv ?? '',
    notes: pack.notes ?? '',
  }
}

export function packEmailDraft(pack: ApplicationPack, userEmail?: string): string {
  return `Subject: Application for ${pack.role} at ${pack.company}

Dear Hiring Team,

Please find my application for the ${pack.role} position attached below.

${pack.cover_letter ?? ''}

Best regards,
${userEmail ?? '[Your name]'}

---
Tailored CV summary:
${(pack.tailored_cv ?? '').slice(0, 800)}...`
}
