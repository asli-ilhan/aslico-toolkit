/** Shared Playwright form-fill logic for Job Agent autofill. */

export const FIELD_SELECTORS = {
  coverLetter: [
    'textarea[name*="cover"]',
    'textarea[id*="cover"]',
    'textarea[placeholder*="cover" i]',
    'textarea[name*="letter"]',
    'textarea[aria-label*="cover" i]',
    'textarea',
  ],
  cv: [
    'textarea[name*="resume"]',
    'textarea[name*="cv"]',
    'textarea[id*="resume"]',
    'textarea[placeholder*="resume" i]',
  ],
  name: ['input[name*="name"]', 'input[id*="name"]', 'input[autocomplete="name"]'],
  email: [
    'input[type="email"]',
    'input[name*="email"]',
    'input[id*="email"]',
    'input[autocomplete="email"]',
  ],
  phone: ['input[type="tel"]', 'input[name*="phone"]', 'input[id*="phone"]'],
  linkedin: ['input[name*="linkedin"]', 'input[id*="linkedin"]', 'input[placeholder*="linkedin" i]'],
}

export async function fillFirst(page, selectorsList, value) {
  if (!value?.trim()) return false
  for (const sel of selectorsList) {
    const el = page.locator(sel).first()
    if ((await el.count()) > 0) {
      try {
        await el.fill(value.slice(0, 8000))
        return true
      } catch {
        /* try next selector */
      }
    }
  }
  return false
}

export async function autofillApplicationPage(page, pack, senderEmail) {
  const results = {
    coverLetter: false,
    cv: false,
    name: false,
    email: false,
  }

  const cover = pack.coverLetter ?? pack.cover_letter ?? ''
  const cv = pack.cv ?? pack.tailored_cv ?? ''

  results.coverLetter = await fillFirst(page, FIELD_SELECTORS.coverLetter, cover)
  results.cv = await fillFirst(page, FIELD_SELECTORS.cv, cv)

  if (senderEmail) {
    results.email = await fillFirst(page, FIELD_SELECTORS.email, senderEmail)
  }

  return results
}
