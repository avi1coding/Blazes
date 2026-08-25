import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { X as XIcon, BarChart3, Clock, Check, X as XMark, Users, Target, Flame, Crown, Lock } from 'lucide-react';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// One drill-down modal for every analytics card. `type` controls which shape
// we render: question | kit | student | question_type. The endpoint is
// teacher-scoped server-side so a guessed id can't leak data across teachers.
export default function AnalyticsDetailModal({ teacherId, type, id, label, pro, onClose }) {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pro || !type || !id || !teacherId) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`${BASE}/api/analytics/teacher/${teacherId}/detail?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load')))
      .then(d => { if (!cancelled) setData(d); })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [pro, type, id, teacherId]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="px-5 sm:px-7 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <div className="text-lg font-black text-gray-900">{titleFor(type)}</div>
              <div className="text-xs font-bold text-gray-500 truncate max-w-md">{label || ''}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <XIcon className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {!pro ? (
          <ProUpsell onClose={onClose} navigate={navigate} />
        ) : loading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Flame className="w-10 h-10 text-red-500 animate-pulse" />
          </div>
        ) : error || !data ? (
          <div className="flex-1 flex items-center justify-center py-16 text-gray-500 font-semibold text-sm">
            {error || "Couldn't load details."}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {type === 'question' && <QuestionDetail data={data} />}
            {type === 'kit' && <KitDetail data={data} />}
            {type === 'student' && <StudentDetail data={data} />}
            {type === 'question_type' && <QuestionTypeDetail data={data} />}
          </div>
        )}
      </div>
    </div>
  );
}

function titleFor(type) {
  if (type === 'question') return 'Question Deep Dive';
  if (type === 'kit') return 'Kit Performance';
  if (type === 'student') return 'Student Profile';
  if (type === 'question_type') return 'Question Type';
  return 'Details';
}

function ProUpsell({ onClose, navigate }) {
  return (
    <div className="p-8 text-center">
      <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center">
        <Crown className="w-7 h-7 text-purple-600" />
      </div>
      <h3 className="text-xl font-black text-gray-900 mb-1.5 flex items-center justify-center gap-2">
        Deep analytics
        <Lock className="w-4 h-4 text-purple-400" />
      </h3>
      <p className="text-sm text-gray-600 mb-5 max-w-md mx-auto">
        Click any analytics card to see who answered what, time per attempt,
        per-question accuracy across your roster, and a full student profile,         with Teacher Pro.
      </p>
      <div className="flex justify-center gap-2">
        <button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-gray-100 text-gray-800 font-black text-sm hover:bg-gray-200">
          Not now
        </button>
        <button
          onClick={() => navigate('/upgrade')}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm hover:from-purple-700 hover:to-indigo-700"
        >
          Unlock with Teacher Pro
        </button>
      </div>
    </div>
  );
}

function Pill({ label, value, color = 'bg-gray-50 text-gray-700' }) {
  return (
    <div className={`px-3 py-1.5 rounded-lg ${color} flex items-center gap-1.5`}>
      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">{label}</span>
      <span className="font-black tabular-nums text-sm">{value}</span>
    </div>
  );
}

function QuestionDetail({ data }) {
  const { question, attempts = [] } = data || {};
  const correct = attempts.filter(a => a.is_correct).length;
  const acc = attempts.length > 0 ? Math.round((correct / attempts.length) * 100) : 0;
  const avgTime = attempts.length > 0
    ? (attempts.reduce((s, a) => s + (Number(a.time_taken) || 0), 0) / attempts.length).toFixed(1)
    : '-';
  return (
    <div className="p-5 space-y-5">
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
        <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-1">Question</div>
        <div className="text-base font-bold text-gray-900 mb-2">{question?.question_text}</div>
        <div className="text-xs text-gray-500 font-semibold">
          {question?.kit_title ? `${question.kit_title}` : ''}{question?.subject ? ` · ${question.subject}` : ''}
          {question?.answer_type ? ` · ${question.answer_type}` : ''}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Pill label="Correct answer" value={question?.correct_answer || '-'} color="bg-emerald-50 text-emerald-700" />
          {attempts.length > 0 && <Pill label="Attempts" value={attempts.length} />}
          {attempts.length > 0 && (
            <Pill
              label="Class accuracy"
              value={`${acc}%`}
              color={acc >= 80 ? 'bg-emerald-50 text-emerald-700' : acc >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}
            />
          )}
          {avgTime !== '-' && <Pill label="Avg time" value={`${avgTime}s`} color="bg-purple-50 text-purple-700" />}
        </div>
      </div>

      <div>
        <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
          <Users className="w-3.5 h-3.5" /> Every attempt
        </div>
        {attempts.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm font-semibold">No attempts yet.</div>
        ) : (
          <ul className="space-y-1.5">
            {attempts.map((a, i) => (
              <li key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 bg-white">
                <div className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-black"
                     style={{ background: a.is_correct ? '#10b981' : '#ef4444' }}>
                  {a.is_correct ? <Check className="w-3.5 h-3.5" strokeWidth={3} /> : <XMark className="w-3.5 h-3.5" strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm text-gray-900 truncate">{a.student_name}</div>
                  <div className="text-[11px] text-gray-500 font-medium">
                    Answered <span className="font-bold text-gray-700">{a.answer ?? '-'}</span>
                    {a.time_taken != null && <> · <Clock className="inline w-3 h-3 -mt-0.5" /> {Number(a.time_taken).toFixed(1)}s</>}
                    {a.game_code && <> · {a.game_code}</>}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function KitDetail({ data }) {
  const { kit, games = [], perQuestion = [], topPlayers = [] } = data || {};
  return (
    <div className="p-5 space-y-5">
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
        <div className="text-base font-black text-gray-900">{kit?.title}</div>
        <div className="text-xs text-gray-500 font-semibold mt-0.5">
          {kit?.subject || '-'}{kit?.grade_level ? ` · ${kit.grade_level}` : ''}
        </div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Pill label="Games" value={games.length} />
          <Pill label="Questions tracked" value={perQuestion.length} />
          <Pill label="Players" value={topPlayers.length} />
        </div>
      </div>

      <Section title="Question difficulty inside this kit" icon={BarChart3}>
        {perQuestion.length === 0 ? <Empty>No question data yet.</Empty> : (
          <ul className="space-y-2">
            {perQuestion.map(q => {
              const has = q.times_answered > 0;
              const acc = has ? Math.round((q.correct / q.times_answered) * 100) : null;
              return (
                <li key={q.id} className="rounded-xl border border-gray-200 p-3 bg-white">
                  <div className="flex items-center justify-between gap-3 mb-1.5">
                    <div className="text-xs font-bold text-gray-900 truncate flex-1">{q.question_text}</div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-[11px] font-bold text-gray-500 tabular-nums">{q.correct}/{q.times_answered}</span>
                      {q.avg_time != null && <span className="text-[11px] font-bold text-gray-500 tabular-nums flex items-center gap-1"><Clock className="w-3 h-3" /> {Number(q.avg_time).toFixed(1)}s</span>}
                      <span className="text-sm font-black tabular-nums" style={{ color: !has ? '#9ca3af' : acc >= 80 ? '#059669' : acc >= 50 ? '#d97706' : '#dc2626' }}>{has ? `${acc}%` : 'NONE'}</span>
                    </div>
                  </div>
                  <Bar acc={acc} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Top players on this kit" icon={Crown}>
        {topPlayers.length === 0 ? <Empty>No players yet.</Empty> : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] font-black uppercase tracking-widest text-gray-400 border-b border-gray-200">
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 px-3 text-right">Correct</th>
                <th className="py-2 px-3 text-right">Avg time</th>
                <th className="py-2 pl-3 text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {topPlayers.map(p => {
                const has = p.total > 0; const acc = has ? Math.round((p.correct / p.total) * 100) : 0;
                return (
                  <tr key={p.id} className="border-b border-gray-100 last:border-b-0">
                    <td className="py-2.5 pr-3 font-bold text-gray-900 truncate">{p.name}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-gray-700 tabular-nums">{p.correct}/{p.total}</td>
                    <td className="py-2.5 px-3 text-right text-gray-600 tabular-nums">{p.avg_time != null ? `${Number(p.avg_time).toFixed(1)}s` : '-'}</td>
                    <td className="py-2.5 pl-3 text-right font-black tabular-nums" style={{ color: acc >= 80 ? '#059669' : acc >= 50 ? '#d97706' : '#dc2626' }}>{acc}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Recent games" icon={Target}>
        {games.length === 0 ? <Empty>No games played with this kit.</Empty> : (
          <ul className="space-y-1.5">
            {games.slice(0, 12).map(g => {
              const has = g.total > 0; const acc = has ? Math.round((g.correct / g.total) * 100) : 0;
              return (
                <li key={g.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white border border-gray-200">
                  <span className="font-mono text-xs font-black text-gray-700">{g.game_code}</span>
                  <span className="text-xs text-gray-500 flex-1 truncate">{g.game_mode}{g.created_at ? ` · ${new Date(g.created_at).toLocaleDateString()}` : ''}</span>
                  <span className="text-xs font-bold text-gray-600 tabular-nums">{g.players || 0} players</span>
                  <span className="text-xs font-black tabular-nums" style={{ color: !has ? '#9ca3af' : acc >= 80 ? '#059669' : acc >= 50 ? '#d97706' : '#dc2626' }}>{has ? `${acc}%` : 'NONE'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function StudentDetail({ data }) {
  const { student, games = [], weakest = [], byType = [] } = data || {};
  const totalAns = byType.reduce((s, t) => s + (t.total || 0), 0);
  const totalCorrect = byType.reduce((s, t) => s + (t.correct || 0), 0);
  const hasAns = totalAns > 0;
  const overallAcc = hasAns ? Math.round((totalCorrect / totalAns) * 100) : 0;
  return (
    <div className="p-5 space-y-5">
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
        <div className="text-base font-black text-gray-900">{student?.name}</div>
        <div className="text-xs text-gray-500 font-semibold mt-0.5">{student?.email || ''}</div>
        <div className="flex flex-wrap gap-2 mt-3">
          <Pill label="Games" value={games.length} />
          <Pill label="Answered" value={totalAns} />
          <Pill
            label="Overall accuracy"
            value={hasAns ? `${overallAcc}%` : 'NONE'}
            color={!hasAns ? 'bg-gray-100 text-gray-500' : overallAcc >= 80 ? 'bg-emerald-50 text-emerald-700' : overallAcc >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}
          />
        </div>
      </div>

      <Section title="Strength by question type" icon={BarChart3}>
        {byType.length === 0 ? <Empty>No data yet.</Empty> : (
          <ul className="space-y-1.5">
            {byType.map(t => {
              const has = t.total > 0; const acc = has ? Math.round((t.correct / t.total) * 100) : 0;
              return (
                <li key={t.answer_type} className="rounded-lg border border-gray-200 p-2.5 bg-white">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="text-xs font-bold text-gray-800 capitalize">{(t.answer_type || '').replace('_', ' ')}</div>
                    <div className="flex items-center gap-3">
                      <span className="text-[11px] font-bold text-gray-500 tabular-nums">{t.correct}/{t.total}</span>
                      {t.avg_time != null && <span className="text-[11px] font-bold text-gray-500 tabular-nums">{Number(t.avg_time).toFixed(1)}s</span>}
                      <span className="text-sm font-black tabular-nums" style={{ color: !has ? '#9ca3af' : acc >= 80 ? '#059669' : acc >= 50 ? '#d97706' : '#dc2626' }}>{has ? `${acc}%` : 'NONE'}</span>
                    </div>
                  </div>
                  <Bar acc={acc} />
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Weakest questions" icon={Target}>
        {weakest.length === 0 ? <Empty>No weak areas yet. Every question has been answered correctly.</Empty> : (
          <ul className="space-y-1.5">
            {weakest.map(q => {
              const has = q.times_answered > 0; const acc = has ? Math.round((q.correct / q.times_answered) * 100) : 0;
              return (
                <li key={q.id} className="rounded-lg border border-gray-200 p-2.5 bg-white">
                  <div className="text-xs font-bold text-gray-900 truncate">{q.question_text}</div>
                  <div className="flex items-center gap-3 mt-1 text-[11px]">
                    <span className="text-gray-500 font-semibold truncate">{q.kit_title || ''}</span>
                    <span className="text-gray-500 tabular-nums">{q.correct}/{q.times_answered}</span>
                    {q.avg_time != null && <span className="text-gray-500 tabular-nums">· {Number(q.avg_time).toFixed(1)}s</span>}
                    <span className="ml-auto font-black tabular-nums" style={{ color: !has ? '#9ca3af' : acc >= 80 ? '#059669' : acc >= 50 ? '#d97706' : '#dc2626' }}>{has ? `${acc}%` : 'NONE'}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Recent games" icon={Crown}>
        {games.length === 0 ? <Empty>No games yet.</Empty> : (
          <ul className="space-y-1.5">
            {games.slice(0, 15).map((g, i) => {
              const has = g.total > 0; const acc = has ? Math.round((g.correct / g.total) * 100) : 0;
              return (
                <li key={`${g.game_code}-${i}`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white border border-gray-200">
                  <span className="font-mono text-xs font-black text-gray-700">{g.game_code}</span>
                  <span className="text-xs text-gray-500 flex-1 truncate">{g.kit_title || g.game_mode}</span>
                  <span className="text-xs font-bold text-gray-600 tabular-nums">{g.correct}/{g.total}</span>
                  <span className="text-xs font-black tabular-nums" style={{ color: !has ? '#9ca3af' : acc >= 80 ? '#059669' : acc >= 50 ? '#d97706' : '#dc2626' }}>{has ? `${acc}%` : 'NONE'}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function QuestionTypeDetail({ data }) {
  const { answer_type, rows = [] } = data || {};
  const total = rows.reduce((s, r) => s + (r.times_answered || 0), 0);
  const correct = rows.reduce((s, r) => s + (r.correct || 0), 0);
  const has = total > 0;
  const acc = has ? Math.round((correct / total) * 100) : 0;
  return (
    <div className="p-5 space-y-5">
      <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4 flex flex-wrap items-center gap-3">
        <div className="font-black text-gray-900 capitalize">{(answer_type || '').replace('_', ' ')}</div>
        <div className="flex flex-wrap gap-2">
          <Pill label="Questions" value={rows.length} />
          <Pill label="Attempts" value={total} />
          <Pill
            label="Accuracy"
            value={has ? `${acc}%` : 'NONE'}
            color={!has ? 'bg-gray-100 text-gray-500' : acc >= 80 ? 'bg-emerald-50 text-emerald-700' : acc >= 50 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}
          />
        </div>
      </div>
      <Section title="Each question of this type (hardest first)" icon={Target}>
        {rows.length === 0 ? <Empty>No questions of this type yet.</Empty> : (
          <ul className="space-y-1.5">
            {rows.map(q => {
              const has = q.times_answered > 0; const a = has ? Math.round((q.correct / q.times_answered) * 100) : 0;
              return (
                <li key={q.question_id} className="rounded-lg border border-gray-200 p-2.5 bg-white">
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <div className="text-xs font-bold text-gray-900 truncate flex-1">{q.question_text}</div>
                    <span className="text-sm font-black tabular-nums" style={{ color: !has ? '#9ca3af' : a >= 80 ? '#059669' : a >= 50 ? '#d97706' : '#dc2626' }}>{has ? `${a}%` : 'NONE'}</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 font-semibold">
                    <span className="truncate">{q.kit_name || ''}</span>
                    <span className="tabular-nums">{q.correct}/{q.times_answered}</span>
                    {q.avg_time != null && <span className="tabular-nums">{Number(q.avg_time).toFixed(1)}s</span>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, icon: Icon, children }) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-widest text-gray-500 mb-2 flex items-center gap-2">
        {Icon && <Icon className="w-3.5 h-3.5" />} {title}
      </div>
      {children}
    </div>
  );
}

function Empty({ children }) {
  return <div className="text-center py-6 text-gray-400 text-xs font-semibold">{children}</div>;
}

function Bar({ acc }) {
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      {acc != null && (
        <div
          className="h-full transition-all"
          style={{
            width: `${acc}%`,
            background: acc >= 80 ? '#10b981' : acc >= 50 ? '#f59e0b' : '#ef4444',
          }}
        />
      )}
    </div>
  );
}
