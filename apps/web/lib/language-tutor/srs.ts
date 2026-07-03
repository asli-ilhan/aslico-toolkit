/** Simplified SM-2 spaced repetition. quality: 0-5 */
export function nextReview(
  quality: number,
  repetitions: number,
  intervalDays: number,
  easeFactor: number,
): { repetitions: number; intervalDays: number; easeFactor: number; nextReviewAt: string } {
  let rep = repetitions
  let interval = intervalDays
  let ease = easeFactor

  if (quality < 3) {
    rep = 0
    interval = 1
  } else {
    if (rep === 0) interval = 1
    else if (rep === 1) interval = 3
    else if (rep === 2) interval = 7
    else interval = Math.round(interval * ease)
    rep++
    ease = Math.max(1.3, ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)))
  }

  const next = new Date()
  next.setDate(next.getDate() + interval)
  return {
    repetitions: rep,
    intervalDays: interval,
    easeFactor: Math.round(ease * 100) / 100,
    nextReviewAt: next.toISOString().slice(0, 10),
  }
}
