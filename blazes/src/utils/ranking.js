// Tie-breaking comparator for leaderboards.
// Order: score → correct answers → faster avg time → user_id (final fallback)
// Returns sorted copy with `rank` field added (1, 2, 3, ...) — no ties ever.

export function rankParticipants(participants) {
  if (!Array.isArray(participants)) return [];

  const sorted = [...participants].sort((a, b) => {
    // 1. Higher score wins
    const scoreA = a.score || 0;
    const scoreB = b.score || 0;
    if (scoreA !== scoreB) return scoreB - scoreA;

    // 2. More correct answers wins
    const correctA = a.correct_answers || a.correctCount || 0;
    const correctB = b.correct_answers || b.correctCount || 0;
    if (correctA !== correctB) return correctB - correctA;

    // 3. Faster avg time wins (lower is better)
    const timeA = a.avg_time || a.avgTime || Infinity;
    const timeB = b.avg_time || b.avgTime || Infinity;
    if (timeA !== timeB) return timeA - timeB;

    // 4. Final fallback: user_id (deterministic, no random)
    return (a.user_id || a.userId || 0) - (b.user_id || b.userId || 0);
  });

  // Always assign distinct ranks 1, 2, 3 — even if values were tied
  return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
}

// Just the comparator if you don't want the rank field
export function rankComparator(a, b) {
  const scoreA = a.score || 0;
  const scoreB = b.score || 0;
  if (scoreA !== scoreB) return scoreB - scoreA;
  const correctA = a.correct_answers || a.correctCount || 0;
  const correctB = b.correct_answers || b.correctCount || 0;
  if (correctA !== correctB) return correctB - correctA;
  const timeA = a.avg_time || a.avgTime || Infinity;
  const timeB = b.avg_time || b.avgTime || Infinity;
  if (timeA !== timeB) return timeA - timeB;
  return (a.user_id || a.userId || 0) - (b.user_id || b.userId || 0);
}
