import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Users, Zap, Clock, Target, X as XIcon, Flame, Lock, ChevronDown, ChevronRight, Check, X as XMark, Crown } from 'lucide-react';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// Format a participant's score using the same dollar formatting as the rest of
// the app for elemental_markets games and plain integers everywhere else.
function fmtScore(value, mode) {
  if (mode === 'elemental_markets') {
    return `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  }
  return String(value || 0);
}

// Shared "view stats" modal used by both TeacherGameResults (after a game
// ends) and TeacherHome's Recent Games table (click any row). Fetches
// /api/games/:gameCode/details on first open and caches the result for the
// lifetime of the modal instance.
//
// `pro` (boolean) unlocks deeper analytics: per-question accuracy across the
// class, per-player breakdown rows you can expand to see every individual
// answer with its time and correctness. Free teachers see the basic summary +
// per-player table and an upgrade nudge for the rest.
export default function GameStatsModal({ gameCode, onClose, pro = false }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedPlayer, setExpandedPlayer] = useState(null); // user_id

  useEffect(() => {
    if (!gameCode) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${BASE}/api/games/${gameCode}/details`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load')))
      .then(d => { if (!cancelled) setStats(d); })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [gameCode]);

  if (!gameCode) return null;

  const topScore = stats?.participants?.length > 0
    ? Math.max(...stats.participants.map(p => Number(p.score) || 0))
    : 0;
  const totalAcc = stats?.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 sm:px-7 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="text-lg font-black text-gray-900">Game Stats</div>
              <div className="text-xs font-bold text-gray-500">
                {gameCode}{stats?.kit_title ? ` · ${stats.kit_title}` : ''}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Flame className="w-10 h-10 text-red-500 animate-pulse" />
          </div>
        ) : error || !stats ? (
          <div className="flex-1 flex items-center justify-center py-16 text-gray-500 font-semibold text-sm">
            {error || "Couldn't load stats."}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Top summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-5 border-b border-gray-100">
              <StatBox icon={Users} color="text-green-600" label="Players" value={stats.players || 0} />
              <StatBox icon={Zap} color="text-yellow-500" label="Top Score" value={fmtScore(topScore, stats.game_mode)} />
              <StatBox icon={BarChart3} color="text-blue-600" label="Avg Score" value={fmtScore(stats.avg_score, stats.game_mode)} />
              <StatBox icon={Clock} color="text-purple-600" label="Avg Time" value={stats.avg_time ? `${Number(stats.avg_time).toFixed(1)}s` : '—'} />
            </div>

            {/* Overall accuracy bar */}
            {totalAcc != null && (
              <div className="px-5 py-4 border-b border-gray-100">
                <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-gray-500 mb-2">
                  <span>Overall Accuracy</span>
                  <span className="text-gray-900 tabular-nums">{stats.correct}/{stats.total} · {totalAcc}%</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${totalAcc}%`,
                      background: totalAcc >= 80 ? 'linear-gradient(90deg, #10b981, #059669)'
                        : totalAcc >= 50 ? 'linear-gradient(90deg, #f59e0b, #d97706)'
                        : 'linear-gradient(90deg, #ef4444, #dc2626)',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Per-player breakdown — Pro tier makes each row expandable so the
                teacher can drill into every individual answer (which one,
                correct/wrong, time taken). Free tier sees just the summary
                row and an upgrade nudge below the table. */}
            <div className="p-5">
              <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
                <Target className="w-3.5 h-3.5" /> Per-player breakdown
              </div>
              {(stats.participants || []).length === 0 ? (
                <div className="text-center py-8 text-gray-500 font-semibold text-sm">No players in this game.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200">
                        <th className="py-2 pr-3">Player</th>
                        <th className="py-2 px-3 text-right">Score</th>
                        <th className="py-2 px-3 text-right">Correct</th>
                        <th className="py-2 pl-3 text-right">Accuracy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.participants.map(p => {
                        const expanded = pro && expandedPlayer === p.user_id;
                        return (
                          <>
                            <tr
                              key={p.user_id}
                              onClick={() => pro && setExpandedPlayer(expanded ? null : p.user_id)}
                              className={`border-b border-gray-100 last:border-b-0 ${pro ? 'cursor-pointer hover:bg-gray-50' : ''}`}
                            >
                              <td className="py-2.5 pr-3 font-bold text-gray-900 truncate flex items-center gap-1.5">
                                {pro && (expanded
                                  ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                  : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />)}
                                {p.player_name || p.user_name || 'Player'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-black tabular-nums text-gray-900">{fmtScore(p.score, stats.game_mode)}</td>
                              <td className="py-2.5 px-3 text-right font-bold text-gray-700 tabular-nums">{p.correct_answers}/{p.total_answered}</td>
                              <td className="py-2.5 pl-3 text-right font-black tabular-nums" style={{ color: p.total_answered === 0 ? '#9ca3af' : p.accuracy >= 80 ? '#059669' : p.accuracy >= 50 ? '#d97706' : '#dc2626' }}>
                                {p.total_answered === 0 ? 'NONE' : `${p.accuracy}%`}
                              </td>
                            </tr>
                            {expanded && (
                              <tr key={`${p.user_id}-detail`} className="bg-gray-50/60">
                                <td colSpan={4} className="px-4 py-3">
                                  <PlayerAnswers answers={p.answers || []} />
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pro-only: per-question accuracy across the class */}
            {pro && <PerQuestionAccuracy participants={stats.participants || []} />}

            {/* Free teachers get an upsell teaser */}
            {!pro && (
              <div className="mx-5 mb-5 rounded-2xl border border-purple-200 bg-gradient-to-br from-purple-50 to-indigo-50 p-5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                    <Crown className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-gray-900 text-sm mb-0.5 flex items-center gap-1.5">
                      Deep stats with Teacher Pro
                      <Lock className="w-3.5 h-3.5 text-purple-400" />
                    </div>
                    <p className="text-xs text-gray-600 mb-3">
                      Click any player to see every answer with timing. Plus per-question accuracy across the class so you can spot exactly which questions tripped students up.
                    </p>
                    <button
                      onClick={() => navigate('/upgrade')}
                      className="text-xs font-black px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors"
                    >
                      Unlock with Teacher Pro
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Pro-only: each individual answer the player gave, with time taken and a
// correct/incorrect mark.
function PlayerAnswers({ answers }) {
  if (!answers || answers.length === 0) {
    return <div className="text-xs text-gray-500 font-semibold py-2">No answers recorded.</div>;
  }
  return (
    <ol className="space-y-1.5">
      {answers.map((a, i) => (
        <li
          key={`${a.question_id}-${i}`}
          className="flex items-start gap-3 px-3 py-2 rounded-lg bg-white border border-gray-200"
        >
          <div className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-black"
               style={{ background: a.is_correct ? '#10b981' : '#ef4444' }}>
            {a.is_correct ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <XMark className="w-3.5 h-3.5" strokeWidth={3} />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-gray-900 truncate">Q{i + 1}. {a.question_text || '—'}</div>
            <div className="text-[11px] text-gray-500 font-medium">
              Answered <span className="font-bold text-gray-700">{a.answer ?? '—'}</span>
              {a.time_taken != null && <> · <Clock className="inline w-3 h-3 -mt-0.5" /> {Number(a.time_taken).toFixed(1)}s</>}
              {a.points_earned != null && <> · +{a.points_earned} pts</>}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Pro-only: roll up every participant's answers by question_id to show class
// accuracy on each question, sorted by hardest-first so the teacher can see
// what to reteach.
function PerQuestionAccuracy({ participants }) {
  const byQ = new Map();
  for (const p of participants) {
    for (const a of (p.answers || [])) {
      if (!a.question_id) continue;
      const cur = byQ.get(a.question_id) || { question_text: a.question_text, total: 0, correct: 0, time_sum: 0, time_n: 0 };
      cur.total += 1;
      if (a.is_correct) cur.correct += 1;
      if (a.time_taken != null) { cur.time_sum += Number(a.time_taken); cur.time_n += 1; }
      byQ.set(a.question_id, cur);
    }
  }
  const rows = Array.from(byQ.entries())
    .map(([qid, v]) => ({
      qid,
      text: v.question_text || '—',
      total: v.total,
      correct: v.correct,
      acc: v.total > 0 ? Math.round((v.correct / v.total) * 100) : null,
      avgTime: v.time_n > 0 ? v.time_sum / v.time_n : null,
    }))
    .sort((a, b) => (a.acc ?? 101) - (b.acc ?? 101));

  if (rows.length === 0) return null;

  return (
    <div className="px-5 pb-5">
      <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
        <BarChart3 className="w-3.5 h-3.5" /> Per-question class accuracy
        <span className="ml-auto text-[10px] font-bold text-gray-400 normal-case tracking-normal">Hardest first</span>
      </div>
      <ul className="space-y-2">
        {rows.map(r => (
          <li key={r.qid} className="rounded-xl border border-gray-200 p-3 bg-white">
            <div className="flex items-center justify-between gap-3 mb-2">
              <div className="text-xs font-bold text-gray-900 truncate flex-1">{r.text}</div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="text-[11px] font-bold text-gray-500 tabular-nums">{r.correct}/{r.total}</span>
                {r.avgTime != null && (
                  <span className="text-[11px] font-bold text-gray-500 tabular-nums flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {r.avgTime.toFixed(1)}s
                  </span>
                )}
                <span className="text-sm font-black tabular-nums" style={{ color: r.acc == null ? '#9ca3af' : r.acc >= 80 ? '#059669' : r.acc >= 50 ? '#d97706' : '#dc2626' }}>
                  {r.acc == null ? 'NONE' : `${r.acc}%`}
                </span>
              </div>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              {r.acc != null && (
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${r.acc}%`,
                    background: r.acc >= 80 ? '#10b981' : r.acc >= 50 ? '#f59e0b' : '#ef4444',
                  }}
                />
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StatBox({ icon: Icon, color, label, value }) {
  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} strokeWidth={2.5} />
      <div className="text-lg font-black text-gray-900">{value}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</div>
    </div>
  );
}
