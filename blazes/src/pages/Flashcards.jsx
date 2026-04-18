import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, RotateCcw, Check, X, Sparkles, Minus, Plus } from 'lucide-react';

export default function Flashcards() {
  const { kitId } = useParams();
  const navigate = useNavigate();
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [phase, setPhase] = useState('pick'); // 'pick' | 'loading' | 'study'
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [count, setCount] = useState(10);
  const [cards, setCards] = useState([]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [error, setError] = useState('');
  const [known, setKnown] = useState(new Set());
  const [slideDir, setSlideDir] = useState(null);

  // Fetch question count on mount
  useEffect(() => {
    fetch(`${base}/api/flashcards/${kitId}?userId=${user.id}&count=1`)
      .then(r => r.json())
      .then(d => {
        if (d.error === 'upgrade_required') { navigate('/upgrade'); return; }
        if (d.total !== undefined) {
          setTotalQuestions(d.total);
          setCount(Math.min(10, d.total));
        } else if (d.error) {
          setError(d.error);
        }
      })
      .catch(() => setError('Connection failed'));
  }, [kitId]);

  const generate = () => {
    setPhase('loading');
    setError('');
    fetch(`${base}/api/flashcards/${kitId}?userId=${user.id}&count=${count}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setPhase('pick'); return; }
        if (d.cards && d.cards.length > 0) {
          setCards(d.cards);
          setIndex(0);
          setFlipped(false);
          setKnown(new Set());
          setPhase('study');
        } else {
          setError('No flashcards generated');
          setPhase('pick');
        }
      })
      .catch(() => { setError('Connection failed'); setPhase('pick'); });
  };

  const handleFlip = () => {
    if (animating) return;
    setAnimating(true);
    setFlipped(!flipped);
    setTimeout(() => setAnimating(false), 500);
  };

  const goTo = (newIndex, dir) => {
    if (animating || newIndex < 0 || newIndex >= cards.length) return;
    setSlideDir(dir);
    setAnimating(true);
    setTimeout(() => {
      setFlipped(false);
      setIndex(newIndex);
      setSlideDir(null);
      setAnimating(false);
    }, 250);
  };

  const handleKnew = () => {
    setKnown(prev => new Set([...prev, cards[index].id]));
    if (index < cards.length - 1) goTo(index + 1, 'left');
    else setFlipped(false);
  };

  const handleDidntKnow = () => {
    if (index < cards.length - 1) goTo(index + 1, 'left');
    else setFlipped(false);
  };

  const presets = [5, 10, 15, 20, 25, 30];

  // ── Pick count screen ──
  if (phase === 'pick') {
    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-sm font-black text-gray-900 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-red-400" /> AI Flashcards
            </div>
            <div className="w-9" />
          </div>
        </nav>
        <div className="max-w-md mx-auto px-4 py-12">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="text-center mb-6">
              <div className="w-12 h-12 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-red-500" />
              </div>
              <h2 className="text-lg font-black text-gray-900">Generate Flashcards</h2>
              <p className="text-sm text-gray-500 mt-1">
                AI creates study cards from your {totalQuestions} question{totalQuestions !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Counter */}
            <div className="flex items-center justify-center gap-4 mb-5">
              <button onClick={() => setCount(c => Math.max(1, c - 1))}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <Minus className="w-4 h-4 text-gray-600" />
              </button>
              <div className="text-4xl font-black text-gray-900 w-16 text-center">{count}</div>
              <button onClick={() => setCount(c => Math.min(50, c + 1))}
                className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                <Plus className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {presets.filter(p => p <= 50).map(p => (
                <button key={p} onClick={() => setCount(p)}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                    count === p ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {p}
                </button>
              ))}
            </div>

            {error && <div className="text-red-500 text-sm font-semibold text-center mb-4">{error}</div>}

            <button onClick={generate} disabled={totalQuestions === 0}
              className="w-full py-3.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-40">
              <Sparkles className="w-4 h-4" /> Generate {count} Flashcard{count !== 1 ? 's' : ''}
            </button>

            <p className="text-xs text-gray-400 text-center mt-3">
              AI will create {count > totalQuestions ? 'extra cards by expanding on the material' : 'cards from your questions'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Loading screen ──
  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center">
            <Sparkles className="w-7 h-7 text-red-400 animate-pulse" />
          </div>
        </div>
        <div className="text-gray-500 font-bold text-sm">Generating {count} flashcards...</div>
        <div className="text-gray-400 text-xs">This takes a few seconds</div>
      </div>
    );
  }

  // ── Error with no cards ──
  if (error) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="text-red-500 font-bold">{error}</div></div>;

  const card = cards[index];

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <button onClick={() => setPhase('pick')} className="p-2 hover:bg-gray-100 rounded-lg" title="Back to setup">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center">
            <div className="text-sm font-black text-gray-900 flex items-center gap-1.5 justify-center">
              <Sparkles className="w-3.5 h-3.5 text-red-400" /> Flashcards
            </div>
            <div className="text-xs text-gray-500">{index + 1} / {cards.length} · {known.size} known</div>
          </div>
          <button onClick={() => { setIndex(0); setFlipped(false); setKnown(new Set()); }}
            className="p-2 hover:bg-gray-100 rounded-lg" title="Restart">
            <RotateCcw className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {cards.length === 0 ? (
          <div className="text-center py-20 text-gray-400 font-bold">No flashcards generated</div>
        ) : (
          <>
            {/* Card with 3D flip */}
            <div onClick={handleFlip} className="cursor-pointer select-none" style={{ perspective: '1000px' }}>
              <div style={{
                transition: 'transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                transformStyle: 'preserve-3d',
                transform: `${flipped ? 'rotateY(180deg)' : 'rotateY(0deg)'} ${slideDir === 'left' ? 'translateX(-120%)' : slideDir === 'right' ? 'translateX(120%)' : 'translateX(0)'}`,
                opacity: slideDir ? 0 : 1,
                minHeight: 300,
                position: 'relative',
              }}>
                {/* Front */}
                <div style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
                  className="bg-white rounded-3xl border-2 border-gray-200 shadow-lg p-8 flex flex-col items-center justify-center text-center">
                  <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{index + 1} / {cards.length}</div>
                  <div className="text-2xl font-black text-gray-900 leading-snug">{card?.front}</div>
                  <div className="text-xs text-gray-300 mt-6">Tap to reveal</div>
                </div>

                {/* Back */}
                <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}
                  className="bg-blue-50 rounded-3xl border-2 border-blue-200 shadow-lg p-8 flex flex-col items-center justify-center text-center overflow-y-auto">
                  <div className="text-xs font-bold text-blue-500 uppercase mb-4">Answer</div>
                  <div className="text-2xl font-black text-blue-700 leading-snug whitespace-pre-line">{card?.back}</div>
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="mt-6">
              {flipped ? (
                <div className="flex gap-4">
                  <button onClick={handleDidntKnow}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors">
                    <X className="w-5 h-5" /> Didn't Know
                  </button>
                  <button onClick={handleKnew}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors">
                    <Check className="w-5 h-5" /> Knew It
                  </button>
                </div>
              ) : (
                <div className="flex gap-4">
                  <button onClick={() => goTo(index - 1, 'right')} disabled={index === 0}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-30">
                    <ChevronLeft className="w-5 h-5" /> Previous
                  </button>
                  <button onClick={() => goTo(index + 1, 'left')} disabled={index === cards.length - 1}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-30">
                    Next <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            {/* Progress */}
            <div className="mt-6">
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full transition-all duration-300" style={{ width: `${((index + 1) / cards.length) * 100}%` }} />
              </div>
              {known.size > 0 && (
                <div className="text-center mt-2 text-xs font-bold text-green-600">{known.size} of {cards.length} mastered</div>
              )}
            </div>

            {/* Done screen */}
            {index === cards.length - 1 && known.size > 0 && !flipped && (
              <div className="mt-8 bg-white rounded-2xl border border-gray-200 p-6 text-center">
                <div className="text-3xl font-black text-gray-900 mb-2">{Math.round(known.size / cards.length * 100)}%</div>
                <div className="text-sm text-gray-500 font-semibold mb-4">{known.size} of {cards.length} cards mastered</div>
                <div className="flex gap-3 justify-center">
                  <button onClick={() => { setIndex(0); setFlipped(false); setKnown(new Set()); }}
                    className="px-5 py-2 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors text-sm">
                    Study Again
                  </button>
                  <button onClick={() => setPhase('pick')}
                    className="px-5 py-2 bg-white border-2 border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors text-sm">
                    New Set
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
