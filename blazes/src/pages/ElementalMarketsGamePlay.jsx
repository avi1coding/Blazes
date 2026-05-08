import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Clock, TrendingUp, TrendingDown, Trophy, BarChart3, X, Eye, ArrowUp, ArrowDown, DollarSign, Newspaper, Activity } from 'lucide-react';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

const REGIME_THEME = {
  normal:   { label: 'Normal',   bg: 'bg-slate-700/40 text-slate-200',   pulse: false },
  bull:     { label: 'Bull Run', bg: 'bg-emerald-500/20 text-emerald-300', pulse: false },
  bear:     { label: 'Bear',     bg: 'bg-orange-500/20 text-orange-300',  pulse: false },
  crash:    { label: 'CRASH',    bg: 'bg-red-500/30 text-red-200',        pulse: true },
  recovery: { label: 'Recovery', bg: 'bg-cyan-500/20 text-cyan-300',      pulse: false },
};

// Cheap inline sparkline. The series is the last N closes; we draw an SVG path.
function Sparkline({ values, color = '#22d3ee', height = 40, width = 140 }) {
  if (!values || values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => `${i * stepX},${height - ((v - min) / range) * height}`);
  const last = values[values.length - 1];
  const first = values[0];
  const trendUp = last >= first;
  const fill = trendUp ? '#10b98133' : '#ef444433';
  const stroke = trendUp ? '#10b981' : '#ef4444';
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <path d={`M0,${height} L${points.join(' L')} L${width},${height} Z`} fill={fill} />
      <path d={`M${points.join(' L')}`} fill="none" stroke={color || stroke} strokeWidth="1.6" />
    </svg>
  );
}

export default function ElementalMarketsGamePlay({ gameCode: propCode, user: propUser }) {
  const params = useParams();
  const gameCode = propCode || params.gameCode;
  const navigate = useNavigate();
  const [user] = useState(() => {
    try { return propUser || JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  });

  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [questionTick, setQuestionTick] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [gameTimeLeft, setGameTimeLeft] = useState(null);
  const [marketState, setMarketState] = useState(null);
  const [tradeStock, setTradeStock] = useState(null); // open trade modal for this symbol
  const [tradeBusy, setTradeBusy] = useState(false);
  const [tradeError, setTradeError] = useState('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [cashFlash, setCashFlash] = useState(null); // { delta } briefly

  const startTimeRef = useRef(Date.now());
  const gameStartedRef = useRef(null);
  const advanceTimeoutRef = useRef(null);

  const settings = useMemo(() => {
    if (!game?.settings) return {};
    try { return typeof game.settings === 'string' ? JSON.parse(game.settings) : game.settings; }
    catch { return {}; }
  }, [game]);

  const currentQ = questions.length > 0 ? questionTick % questions.length : 0;
  const q = questions[currentQ];

  // Notify server when player leaves
  useEffect(() => {
    if (!user?.id) return;
    const sendLeave = () => {
      try { navigator.sendBeacon(`${BASE}/api/games/${gameCode}/leave`, new Blob([JSON.stringify({ userId: user.id })], { type: 'application/json' })); } catch (_) {}
    };
    window.addEventListener('beforeunload', sendLeave);
    return () => window.removeEventListener('beforeunload', sendLeave);
  }, [gameCode, user]);

  // Load game once
  useEffect(() => {
    fetch(`${BASE}/api/games/${gameCode}`).then(r => r.json()).then(setGame).catch(() => {});
  }, [gameCode]);

  // Load questions
  useEffect(() => {
    if (!game) return;
    fetch(`${BASE}/api/kits/${game.kit_id}`).then(r => r.json()).then(data => {
      const qs = Array.isArray(data?.questions) ? data.questions : [];
      setQuestions([...qs].sort(() => Math.random() - 0.5));
    }).catch(() => {});
    if (game.started_at) {
      const s = game.started_at;
      const iso = s.includes('T') ? s : s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z');
      gameStartedRef.current = new Date(iso).getTime();
    }
  }, [game]);

  // Game timer
  const handleGameOver = useCallback(() => {
    navigate(`/game/results/${gameCode}`, { state: { game, user } });
  }, [gameCode, navigate, game, user]);

  useEffect(() => {
    if (!game?.settings) return;
    const totalSec = settings.timeLimit || 600;
    const tick = () => {
      if (!gameStartedRef.current) { setGameTimeLeft(totalSec); return; }
      const elapsed = (Date.now() - gameStartedRef.current) / 1000;
      const left = Math.max(0, Math.ceil(totalSec - elapsed));
      setGameTimeLeft(prev => prev !== left ? left : prev);
      if (left === 0) handleGameOver();
    };
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [game, settings.timeLimit, handleGameOver]);

  // Reset answer state on question change
  useEffect(() => {
    if (!questions.length) return;
    setSelected(null);
    setAnswered(false);
    setFeedback(null);
    startTimeRef.current = Date.now();
  }, [questionTick, questions]);

  // Poll market state
  const fetchMarket = useCallback(async () => {
    if (!user?.id) return;
    try {
      const res = await fetch(`${BASE}/api/games/${gameCode}/markets/state?userId=${user.id}`);
      const data = await res.json();
      setMarketState(data);
    } catch (_) {}
  }, [gameCode, user?.id]);

  useEffect(() => {
    fetchMarket();
    const id = setInterval(fetchMarket, 2000);
    return () => clearInterval(id);
  }, [fetchMarket]);

  const advanceQuestion = useCallback(() => {
    if (advanceTimeoutRef.current) {
      clearTimeout(advanceTimeoutRef.current);
      advanceTimeoutRef.current = null;
    }
    setQuestionTick(t => t + 1);
  }, []);

  const submitAnswer = async (answer) => {
    if (answered) return;
    setAnswered(true);
    if (!q) return;
    const timeTaken = (Date.now() - startTimeRef.current) / 1000;
    const correctAnswer = q.correct_answer;
    const isCorrect = answer && answer.toString().trim().toLowerCase() === String(correctAnswer).trim().toLowerCase();
    setFeedback({ isCorrect, correct: correctAnswer });

    advanceTimeoutRef.current = setTimeout(advanceQuestion, isCorrect ? 700 : 1300);

    try {
      const res = await fetch(`${BASE}/api/games/${gameCode}/markets/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, questionId: q.id, selectedAnswer: answer || '', isCorrect, timeTaken }),
      });
      const data = await res.json();
      if (typeof data?.reward === 'number') {
        setCashFlash({ delta: data.reward, ts: Date.now() });
        setTimeout(() => setCashFlash(null), 1500);
      }
      // Refresh market state to pick up new cash balance
      fetchMarket();
    } catch (_) {}
  };

  const formatTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const fmtMoney = (n) => `$${(Math.round((n || 0) * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cash = marketState?.me?.cash ?? 1000;
  const portfolio = marketState?.me?.portfolio ?? 1000;
  const holdings = marketState?.me?.holdings ?? {};
  const stocks = marketState?.stocks ?? [];
  const events = marketState?.events ?? [];
  const regime = REGIME_THEME[marketState?.regime] || REGIME_THEME.normal;

  const myRank = (marketState?.leaderboard || []).findIndex(p => p.user_id === user?.id) + 1;

  return (
    <div className="min-h-screen flex flex-col text-white" style={{ background: 'radial-gradient(ellipse at top, #0f1729 0%, #060a14 100%)' }}>
      {/* Top bar */}
      <header className="sticky top-0 z-30 bg-black/40 backdrop-blur-md border-b border-white/[0.06] px-3 sm:px-5 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <TrendingUp className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-black">Elemental Markets</div>
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest uppercase ${regime.bg} ${regime.pulse ? 'animate-pulse' : ''}`}>
                {marketState?.regime === 'crash' && <Activity className="w-3 h-3" />}
                {regime.label}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="bg-emerald-500/15 border border-emerald-500/30 rounded-lg px-3 py-2 flex items-center gap-2 relative">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              <span className="font-black tabular-nums text-sm sm:text-base">{fmtMoney(cash)}</span>
              {cashFlash && (
                <span
                  key={cashFlash.ts}
                  className={`absolute -top-3 right-1 text-xs font-black ${cashFlash.delta >= 0 ? 'text-emerald-300' : 'text-red-300'}`}
                  style={{ animation: 'cashFlash 1.4s ease-out forwards' }}
                >
                  {cashFlash.delta >= 0 ? '+' : ''}{fmtMoney(cashFlash.delta)}
                </span>
              )}
            </div>
            <div className="bg-white/[0.05] border border-white/10 rounded-lg px-3 py-2 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-white/70" />
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-white/50 leading-none">Portfolio</div>
                <div className="font-black tabular-nums text-sm sm:text-base leading-none mt-0.5">{fmtMoney(portfolio)}</div>
              </div>
            </div>
            {gameTimeLeft !== null && (
              <div className={`flex items-center gap-2 border rounded-lg px-3 py-2 ${
                gameTimeLeft <= 10 ? 'bg-red-500/20 border-red-400/40 animate-pulse' :
                gameTimeLeft < 60 ? 'bg-orange-500/20 border-orange-400/40' :
                'bg-white/[0.05] border-white/10'
              }`}>
                <Clock className="w-4 h-4" />
                <span className="font-black tabular-nums text-sm sm:text-base">{formatTime(gameTimeLeft)}</span>
              </div>
            )}
            {myRank > 0 && (
              <div className="hidden sm:flex bg-yellow-500/15 border border-yellow-500/30 rounded-lg px-3 py-2 items-center gap-2">
                <Trophy className="w-4 h-4 text-yellow-300" />
                <span className="font-black text-yellow-200">#{myRank}</span>
              </div>
            )}
            <button
              onClick={() => setShowLeaderboard(true)}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 rounded-lg px-3 py-2 font-black text-xs sm:text-sm transition-colors"
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">Leaderboard</span>
            </button>
            {game?.host_id && user?.id && game.host_id === user.id && (
              <button
                onClick={() => window.open(`/game/monitor/${gameCode}/all`, '_blank', 'noopener')}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-3 py-2 font-black text-xs sm:text-sm transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Monitor</span>
              </button>
            )}
          </div>
        </div>
        {/* News ticker */}
        {events.length > 0 && (
          <div className="max-w-7xl mx-auto mt-2 flex items-center gap-2 text-xs">
            <Newspaper className="w-3.5 h-3.5 text-white/50 flex-shrink-0" />
            <div className="flex-1 overflow-hidden whitespace-nowrap">
              <span className="font-black uppercase tracking-wider text-white/50 mr-3">News:</span>
              {events.slice(0, 3).map((ev, i) => (
                <span key={ev.id} className={`mr-6 ${ev.kind === 'crash' ? 'text-red-300' : ev.kind === 'recovery' ? 'text-cyan-300' : ev.kind === 'bull' ? 'text-emerald-300' : ev.kind === 'bear' ? 'text-orange-300' : 'text-white/80'} font-bold`}>
                  {ev.msg}
                </span>
              ))}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-5 py-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Stock grid (2 cols on desktop) */}
        <section className="lg:col-span-2">
          <div className="text-xs font-black uppercase tracking-widest text-white/50 mb-3 ml-1">Markets</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {stocks.map(s => {
              const owned = holdings[s.sym] || 0;
              const positive = s.changePct >= 0;
              return (
                <button
                  key={s.sym}
                  onClick={() => { setTradeStock(s.sym); setTradeError(''); }}
                  className="group relative bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-2xl p-4 text-left transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black tracking-widest" style={{ color: s.color }}>{s.sym}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50">{s.name}</span>
                      </div>
                      <div className="text-2xl font-black tabular-nums mt-0.5">${s.price?.toFixed(2)}</div>
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-black ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {positive ? <ArrowUp className="w-3.5 h-3.5" /> : <ArrowDown className="w-3.5 h-3.5" />}
                      {positive ? '+' : ''}{s.changePct?.toFixed(2)}%
                    </div>
                  </div>
                  <Sparkline values={s.history || []} color={s.color} height={36} width={260} />
                  <div className="flex items-center justify-between mt-2 text-[11px] font-bold">
                    <span className="text-white/50">
                      {owned > 0 ? <span className="text-white">{owned} shares · {fmtMoney(owned * s.price)}</span> : 'Click to trade'}
                    </span>
                    <span className="text-emerald-300/80">Trade →</span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Question card */}
        <section className="lg:col-span-1">
          <div className="text-xs font-black uppercase tracking-widest text-white/50 mb-3 ml-1">Earn Cash</div>
          <div className="bg-white/[0.04] border border-white/[0.08] rounded-2xl p-5">
            {!q ? (
              <div className="text-center text-white/50 py-12">Loading questions…</div>
            ) : (
              <>
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-3">
                  Question {questionTick + 1} · +$50 correct · −$10 wrong
                </div>
                <h2 className="text-lg sm:text-xl font-black leading-tight whitespace-pre-line mb-4">{q.question_text}</h2>
                {q.image_url && (
                  <div className="flex justify-center mb-4">
                    <img src={q.image_url} alt="" className="max-h-32 rounded-lg" />
                  </div>
                )}
                {(() => {
                  const type = q.answer_type || 'multiple_choice';
                  if (type === 'true_false') {
                    return (
                      <div className="grid grid-cols-2 gap-2">
                        {['True', 'False'].map(value => {
                          const isSelected = selected === value;
                          const isCorrect = feedback && String(q.correct_answer).toLowerCase() === value.toLowerCase();
                          const isWrong = feedback && isSelected && !feedback.isCorrect;
                          return (
                            <button key={value} onClick={() => { if (!answered) { setSelected(value); submitAnswer(value); } }}
                              disabled={answered}
                              className={`p-3 rounded-xl font-black border-2 transition-all min-h-[60px] ${
                                isCorrect ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 scale-[1.02]' :
                                isWrong ? 'bg-red-500/30 border-red-400 text-red-200' :
                                isSelected ? 'bg-white/10 border-white/30' :
                                'bg-white/[0.05] border-white/10 hover:bg-white/[0.08]'
                              } disabled:cursor-not-allowed`}>
                              {value}
                            </button>
                          );
                        })}
                      </div>
                    );
                  }
                  if (type === 'short_answer' || type === 'fill_blank' || type === 'math_equation') {
                    return (
                      <form onSubmit={(e) => {
                        e.preventDefault();
                        if (answered) return;
                        const val = e.target.answer.value.trim();
                        if (!val) return;
                        setSelected(val);
                        submitAnswer(val);
                      }} className="flex flex-col gap-2">
                        <input name="answer" type="text" disabled={answered}
                          placeholder="Type your answer…"
                          className="w-full px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-lg text-base focus:border-emerald-500 focus:outline-none disabled:opacity-60" autoFocus />
                        <button type="submit" disabled={answered}
                          className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-black disabled:opacity-50">Submit</button>
                      </form>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 gap-2">
                      {['option_a', 'option_b', 'option_c', 'option_d'].map((key, i) => {
                        const opt = q[key];
                        if (!opt) return null;
                        const letter = ['A', 'B', 'C', 'D'][i];
                        const isSelected = selected === letter;
                        const isCorrectLetter = String(q.correct_answer || '').toUpperCase() === letter;
                        const isCorrect = feedback && isCorrectLetter;
                        const isWrong = feedback && isSelected && !isCorrectLetter;
                        return (
                          <button key={key}
                            onClick={() => { if (!answered) { setSelected(letter); submitAnswer(letter); } }}
                            disabled={answered}
                            className={`p-3 rounded-xl text-left font-bold border-2 transition-all flex items-center gap-3 ${
                              isCorrect ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 scale-[1.01]' :
                              isWrong ? 'bg-red-500/30 border-red-400 text-red-200' :
                              isSelected ? 'bg-white/10 border-white/30' :
                              'bg-white/[0.05] border-white/10 hover:bg-white/[0.08]'
                            } disabled:cursor-not-allowed`}>
                            <span className="text-lg font-black opacity-50 flex-shrink-0">{letter}</span>
                            <span className="flex-1">{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })()}

                {feedback && (
                  <div className={`mt-3 text-center font-black px-3 py-1.5 rounded-full text-sm ${feedback.isCorrect ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}>
                    {feedback.isCorrect ? '+$50 cash earned' : `Answer: ${feedback.correct}  ·  −$10`}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </main>

      {/* Trade modal */}
      {tradeStock && (
        <TradeModal
          symbol={tradeStock}
          stock={stocks.find(s => s.sym === tradeStock)}
          owned={holdings[tradeStock] || 0}
          cash={cash}
          busy={tradeBusy}
          error={tradeError}
          onClose={() => { setTradeStock(null); setTradeError(''); }}
          onTrade={async (action, sharesNum) => {
            setTradeBusy(true);
            setTradeError('');
            try {
              const res = await fetch(`${BASE}/api/games/${gameCode}/markets/${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.id, symbol: tradeStock, shares: sharesNum }),
              });
              const data = await res.json();
              if (!res.ok) { setTradeError(data?.error || 'Trade failed'); }
              else { fetchMarket(); setTradeStock(null); }
            } catch (e) { setTradeError(e.message); }
            finally { setTradeBusy(false); }
          }}
        />
      )}

      {/* Leaderboard modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setShowLeaderboard(false)}>
          <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h2 className="text-xl font-black flex items-center gap-2"><BarChart3 className="w-5 h-5 text-emerald-400" /> Leaderboard</h2>
              <button onClick={() => setShowLeaderboard(false)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {(marketState?.leaderboard || []).length === 0 ? (
                <div className="text-center py-12 text-white/50 font-semibold">No traders yet</div>
              ) : (
                <div className="space-y-2">
                  {(marketState?.leaderboard || []).map((p, i) => {
                    const isMe = p.user_id === user?.id;
                    const start = settings.startingCash || 1000;
                    const pl = p.portfolio - start;
                    return (
                      <div key={p.user_id} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${isMe ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/[0.04] border-transparent'}`}>
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${
                          i === 0 ? 'bg-yellow-400 text-yellow-900' : i === 1 ? 'bg-gray-300 text-gray-800' : i === 2 ? 'bg-orange-400 text-orange-900' : 'bg-white/10 text-white/60'
                        }`}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`font-black text-sm truncate ${isMe ? 'text-emerald-200' : ''}`}>
                            {p.player_name || 'Player'}{isMe && ' (You)'}
                          </div>
                          <div className={`text-xs font-bold ${pl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {pl >= 0 ? '+' : ''}{fmtMoney(pl)}
                          </div>
                        </div>
                        <div className="font-black tabular-nums text-emerald-300 text-sm">{fmtMoney(p.portfolio)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cash-flash keyframes via inline style — once-per-component is fine */}
      <style>{`@keyframes cashFlash {
        0% { opacity: 0; transform: translateY(0); }
        20% { opacity: 1; transform: translateY(-4px); }
        100% { opacity: 0; transform: translateY(-22px); }
      }`}</style>
    </div>
  );
}

function TradeModal({ symbol, stock, owned, cash, busy, error, onClose, onTrade }) {
  const [tab, setTab] = useState('buy');
  const [sharesStr, setSharesStr] = useState('1');
  const sharesNum = Math.max(0, Math.floor(Number(sharesStr) || 0));
  const price = stock?.price || 0;
  const cost = sharesNum * price;
  const maxBuy = price > 0 ? Math.floor(cash / price) : 0;

  if (!stock) return null;
  const positive = stock.changePct >= 0;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-3xl max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-black tracking-widest" style={{ color: stock.color }}>{stock.sym}</span>
              <span className="text-xs font-bold uppercase text-white/50">{stock.name}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-black tabular-nums">${price.toFixed(2)}</span>
              <span className={`text-sm font-black ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                {positive ? '+' : ''}{stock.changePct?.toFixed(2)}%
              </span>
            </div>
            <div className="text-xs text-white/60 mt-1">You own: <span className="font-black text-white">{owned}</span></div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => setTab('buy')}
              className={`py-2 rounded-lg font-black ${tab === 'buy' ? 'bg-emerald-600 text-white' : 'bg-white/[0.05] text-white/60 hover:bg-white/10'}`}>
              Buy
            </button>
            <button onClick={() => setTab('sell')} disabled={owned === 0}
              className={`py-2 rounded-lg font-black ${tab === 'sell' ? 'bg-red-600 text-white' : 'bg-white/[0.05] text-white/60 hover:bg-white/10'} disabled:opacity-40 disabled:cursor-not-allowed`}>
              Sell
            </button>
          </div>

          <label className="block text-xs font-black uppercase tracking-wider text-white/50 mb-2">Shares</label>
          <div className="flex gap-2 mb-2">
            <input type="number" min={1} value={sharesStr}
              onChange={e => setSharesStr(e.target.value)}
              className="flex-1 px-4 py-3 bg-white/[0.05] border-2 border-white/10 rounded-lg text-lg font-black tabular-nums focus:border-emerald-500 focus:outline-none" />
            <button onClick={() => setSharesStr(String(tab === 'buy' ? Math.max(1, maxBuy) : Math.max(1, owned)))}
              className="px-3 py-2 rounded-lg bg-white/[0.05] hover:bg-white/10 text-white/70 font-black text-xs whitespace-nowrap">
              MAX
            </button>
          </div>

          <div className="bg-white/[0.04] rounded-xl p-3 mb-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-white/60">Price</span><span className="font-black tabular-nums">${price.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-white/60">{tab === 'buy' ? 'Cost' : 'Proceeds'}</span><span className="font-black tabular-nums text-emerald-300">${cost.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-white/60">{tab === 'buy' ? 'Cash after' : 'New cash'}</span><span className="font-black tabular-nums">${(cash + (tab === 'buy' ? -cost : cost)).toFixed(2)}</span></div>
          </div>

          {error && <div className="bg-red-500/20 border border-red-500/40 text-red-200 rounded-lg p-2.5 text-xs font-bold mb-3">{error}</div>}

          <button
            onClick={() => onTrade(tab, sharesNum)}
            disabled={busy || sharesNum < 1 || (tab === 'buy' ? cost > cash : sharesNum > owned)}
            className={`w-full py-3 rounded-xl font-black text-base transition-colors ${
              tab === 'buy' ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-red-600 hover:bg-red-500'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {busy ? 'Filling…' : tab === 'buy' ? `Buy ${sharesNum} ${stock.sym}` : `Sell ${sharesNum} ${stock.sym}`}
          </button>
        </div>
      </div>
    </div>
  );
}
