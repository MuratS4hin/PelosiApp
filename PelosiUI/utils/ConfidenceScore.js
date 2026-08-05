/**
 * Computes a 0–100 "Congress Signal Score" for a stock based on its
 * congressional trade history.
 *
 * Score components (100 pts total):
 *   Frequency  (0–40): number of trades filed
 *   Recency    (0–30): how recent the latest trade is
 *   Buy ratio  (0–30): proportion of trades that are purchases
 *
 * Each transaction object must have:
 *   { date: Date | null, type: string }
 */
export const computeConfidenceScore = (transactions) => {
  if (!transactions || transactions.length === 0) return 0;

  const count = transactions.length;

  // ── Frequency (0–40) ─────────────────────────────────────
  const frequencyScore =
    count >= 10 ? 40 :
    count >= 6  ? 30 :
    count >= 3  ? 20 : 10;

  // ── Recency (0–30) ────────────────────────────────────────
  const now = Date.now();
  const timestamps = transactions
    .map((tx) => tx.date)
    .filter(Boolean)
    .map((d) => (d instanceof Date ? d.getTime() : new Date(d).getTime()))
    .filter((t) => !isNaN(t));

  let recencyScore = 0;
  if (timestamps.length > 0) {
    const daysSince = (now - Math.max(...timestamps)) / 86_400_000;
    recencyScore =
      daysSince <= 30  ? 30 :
      daysSince <= 60  ? 22 :
      daysSince <= 90  ? 15 :
      daysSince <= 180 ? 8  : 3;
  }

  // ── Buy ratio (0–30) ─────────────────────────────────────
  const buys = transactions.filter((tx) =>
    (tx.type || '').toLowerCase().includes('purchase')
  ).length;
  const ratio = count > 0 ? buys / count : 0;
  const buyScore =
    ratio >= 1.0  ? 30 :
    ratio >= 0.75 ? 22 :
    ratio >= 0.5  ? 14 :
    ratio >= 0.25 ? 6  : 0;

  return Math.min(100, frequencyScore + recencyScore + buyScore);
};

/**
 * Returns a label and colors for a given score.
 */
export const getScoreLabel = (score) => {
  if (score >= 75) return { label: 'Strong Signal', color: '#1B5E20', bg: '#E8F5E9' };
  if (score >= 50) return { label: 'Moderate',      color: '#2E7D32', bg: '#F1F8E9' };
  if (score >= 25) return { label: 'Weak',          color: '#E65100', bg: '#FFF3E0' };
  return               { label: 'Minimal',          color: '#B71C1C', bg: '#FFEBEE' };
};
