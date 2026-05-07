// Tie-breaking comparator for leaderboards.
// Order: score → accuracy → total questions answered → joined-first → user_id
// The final id-based tie-breaker guarantees a STRICT total ordering so two
// players never share a rank — every leaderboard position is unique.

function getAccuracy(p) {
  const correct = p.correct_answers || p.correctCount || 0;
  const answered = p.questions_answered || p.questionsAnswered || correct;
  return answered > 0 ? correct / answered : 0;
}

export function rankComparator(a, b) {
  // 1. Higher score wins
  const scoreA = a.score || 0;
  const scoreB = b.score || 0;
  if (scoreA !== scoreB) return scoreB - scoreA;
  // 2. Higher accuracy wins
  const accA = getAccuracy(a);
  const accB = getAccuracy(b);
  if (accA !== accB) return accB - accA;
  // 3. More total questions answered wins
  const totalA = a.questions_answered || a.questionsAnswered || a.correct_answers || 0;
  const totalB = b.questions_answered || b.questionsAnswered || b.correct_answers || 0;
  if (totalA !== totalB) return totalB - totalA;
  // 4. Earlier joined_at wins (string compare on ISO timestamps works lexically)
  const joinedA = a.joined_at || '';
  const joinedB = b.joined_at || '';
  if (joinedA !== joinedB) return joinedA < joinedB ? -1 : 1;
  // 5. Final fallback — participant id, then user_id. Deterministic so ranks
  //    are stable across renders and never tie.
  const pidA = a.id || 0;
  const pidB = b.id || 0;
  if (pidA !== pidB) return pidA - pidB;
  return (a.user_id || 0) - (b.user_id || 0);
}

export function rankParticipants(participants) {
  if (!Array.isArray(participants)) return [];
  const sorted = [...participants].sort(rankComparator);
  // Strict ordering guaranteed by the comparator above — every player gets a
  // unique rank, no `tied` flag.
  return sorted.map((p, i) => ({ ...p, rank: i + 1 }));
}
