// Tie-breaking comparator for leaderboards.
// Order: score → accuracy → total questions answered → genuine tie
// Players with all three identical share the same rank.

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
  // 4. Genuine tie — preserve order
  return 0;
}

export function rankParticipants(participants) {
  if (!Array.isArray(participants)) return [];
  const sorted = [...participants].sort(rankComparator);
  // Assign rank, sharing it for genuine ties
  let lastRank = 0;
  let lastIndex = 0;
  return sorted.map((p, i) => {
    if (i > 0 && rankComparator(sorted[i - 1], p) === 0) {
      // Tied with previous → same rank
      return { ...p, rank: lastRank, tied: true };
    }
    lastRank = i + 1;
    lastIndex = i;
    return { ...p, rank: lastRank };
  });
}
