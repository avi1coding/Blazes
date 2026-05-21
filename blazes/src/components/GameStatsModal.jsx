import { useEffect, useState } from 'react';
import { BarChart3, Users, Zap, Clock, Target, X as XIcon, Flame } from 'lucide-react';

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
export default function GameStatsModal({ gameCode, onClose }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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

            {/* Per-player breakdown */}
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
                      {stats.participants.map(p => (
                        <tr key={p.user_id} className="border-b border-gray-100 last:border-b-0">
                          <td className="py-2.5 pr-3 font-bold text-gray-900 truncate">{p.player_name || p.user_name || 'Player'}</td>
                          <td className="py-2.5 px-3 text-right font-black tabular-nums text-gray-900">{fmtScore(p.score, stats.game_mode)}</td>
                          <td className="py-2.5 px-3 text-right font-bold text-gray-700 tabular-nums">{p.correct_answers}/{p.total_answered}</td>
                          <td className="py-2.5 pl-3 text-right font-black tabular-nums" style={{ color: p.accuracy >= 80 ? '#059669' : p.accuracy >= 50 ? '#d97706' : '#dc2626' }}>
                            {p.accuracy}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
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
