/** Serverless time budget — stay under Vercel Hobby ~60s gateway limit. */
export function scanTimeBudgetMs(): number {
  for (const key of ['SCAN_BUDGET_MS', 'JOB_SCAN_BUDGET_MS', 'FUNDING_SCAN_BUDGET_MS']) {
    const fromEnv = Number(process.env[key])
    if (Number.isFinite(fromEnv) && fromEnv >= 15_000) return fromEnv
  }
  return 52_000
}

export function createScanDeadline(budgetMs = scanTimeBudgetMs()) {
  const deadline = Date.now() + budgetMs
  return {
    budgetMs,
    timeUp: () => Date.now() >= deadline,
    remainingMs: () => Math.max(0, deadline - Date.now()),
  }
}

export type ScanDeadline = ReturnType<typeof createScanDeadline>
