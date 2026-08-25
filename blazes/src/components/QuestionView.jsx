import { useState, useEffect, useRef, useCallback } from 'react';
import { Check, X } from 'lucide-react';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

function getFullImageUrl(url) {
  if (!url) return null;
  if (url.startsWith('http') || url.startsWith('data:')) return url;
  return `${BASE}${url}`;
}

/**
 * Renders one question of any supported type, grades it, and reports the result
 * as { correct, ms, answer }.
 *
 * The point of this component is that a game mode never has to know HOW an
 * answer was given. Modes built on it work with every question type, multiple
 * choice, true/false, short answer, fill blank, math, multi-select, image
 * labels, ordering, matching and audio, because all they receive is whether it
 * was right and how long it took.
 *
 * Render it with a `key` that changes per question, e.g.
 *   <QuestionView key={q.id} question={q} onAnswer={...} onNext={...} />
 * so each question gets a fresh component and a fresh clock.
 */
export default function QuestionView({ question, questionNumber = 1, onAnswer, onNext, nextLabel = 'Next' }) {
  const [typed, setTyped] = useState('');
  // Ordering starts pre-populated; the parent remounts this component per
  // question via a `key`, so there is no reset-on-change effect to get wrong.
  const [orderItems, setOrderItems] = useState(
    () => (question?.answerType === 'ordering' ? [...(question.options || [])] : [])
  );
  const [matchSel, setMatchSel] = useState({});
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);
  const [dragMatchItem, setDragMatchItem] = useState(null);
  const [dragOverLeft, setDragOverLeft] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [correct, setCorrect] = useState(null);
  const [picked, setPicked] = useState(null);
  // Set on mount rather than in the initialiser. Date.now() during render is
  // impure, and the clock should start when the question actually appears.
  const startedAt = useRef(0);
  const reportedRef = useRef(false);
  useEffect(() => { startedAt.current = Date.now(); }, []);

  const report = useCallback((isCorrect, answerText) => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    const ms = Date.now() - startedAt.current;
    setCorrect(isCorrect);
    setAnswered(true);
    onAnswer?.({ correct: isCorrect, ms, answer: answerText });
  }, [onAnswer]);

  // ── grading ────────────────────────────────────────────────────────────────
  const gradeIndex = (idx) => {
    setPicked(idx);
    const ca = question.correctAnswer;
    const asNum = Number(ca);
    const isCorrect = Number.isInteger(asNum)
      ? asNum === idx
      : String(ca).toLowerCase() === String(question.options?.[idx] ?? '').toLowerCase();
    report(isCorrect, String(question.options?.[idx] ?? idx));
  };

  const gradeTrueFalse = (idx) => {
    setPicked(idx);
    const label = idx === 0 ? 'true' : 'false';
    const ca = question.correctAnswer;
    const isCorrect = Number(ca) === idx || String(ca).toLowerCase() === label;
    report(isCorrect, label);
  };

  const gradeTyped = async (override) => {
    const value = override ?? typed;
    const t = question.answerType;
    if (t !== 'ordering' && t !== 'matching' && !String(value || '').trim()) return;
    setPicked(String(value || '').trim());

    if (t === 'math_equation') {
      const u = parseFloat(String(value).trim());
      const c = parseFloat(question.correctAnswer);
      return report(!isNaN(u) && !isNaN(c) && Math.abs(u - c) <= Math.abs(c * 0.01) + 0.001, String(value));
    }
    if (t === 'multi_select') {
      const mine = String(value).split('').sort().join('');
      const theirs = String(question.correctAnswer).split('').sort().join('');
      return report(mine === theirs, String(value));
    }
    if (t === 'image_label' && Array.isArray(question.correctAnswer)) {
      return report(
        question.correctAnswer.some(p => p.label.toLowerCase() === String(value).trim().toLowerCase()),
        String(value)
      );
    }
    if (t === 'ordering' && Array.isArray(question.correctAnswer)) {
      const ok = orderItems.length === question.correctAnswer.length
        && orderItems.every((it, i) => it === question.correctAnswer[i]);
      return report(ok, orderItems.join(' > '));
    }
    if (t === 'matching') {
      const pairs = question.correctAnswer;
      const ok = Array.isArray(pairs) && pairs.every(p => matchSel[p.left] === p.right);
      return report(ok, JSON.stringify(matchSel));
    }
    // short_answer / fill_blank. Exact first, then the server's checker
    const exact = String(value).trim().toLowerCase() === String(question.correctAnswer).toLowerCase();
    if (exact) return report(true, String(value));
    try {
      const r = await fetch(`${BASE}/api/check-answer`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userAnswer: String(value).trim(), correctAnswer: String(question.correctAnswer), questionText: question.text }),
      });
      const d = await r.json();
      return report(!!d.isCorrect, String(value));
    } catch {
      return report(false, String(value));
    }
  };

  // ── number keys + Enter ────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'Enter' && answered) { e.preventDefault(); onNext?.(); return; }
      if (answered || !question) return;
      const n = parseInt(e.key, 10);
      if (!Number.isInteger(n) || n < 1) return;
      const idx = n - 1;
      const t = question.answerType;
      const opts = question.options || [];
      if (t === 'true_false' || (!opts.length && !t)) { if (idx < 2) { e.preventDefault(); gradeTrueFalse(idx); } return; }
      if (t === 'multi_select') {
        const letter = ['A', 'B', 'C', 'D'][idx];
        if (!letter || idx >= opts.length) return;
        e.preventDefault();
        setTyped(cur => cur.includes(letter) ? cur.replace(letter, '') : cur + letter);
        return;
      }
      if (t === 'image_label') { if (opts[idx] !== undefined) { e.preventDefault(); gradeTyped(opts[idx]); } return; }
      if (!t || t === 'multiple_choice' || t === 'fill_blank') {
        if (idx < opts.length) { e.preventDefault(); gradeIndex(idx); }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!question) return null;

  const imgUrl = getFullImageUrl(question.imageUrl || question.image_url);
  const type = question.answerType;
  const opts = question.options || [];
  const keycap = (n) => (
    <span className="flex-shrink-0 w-6 h-6 rounded-md bg-gray-100 border border-gray-300 text-gray-500 text-xs font-black flex items-center justify-center">{n}</span>
  );

  const isTextual = type === 'short_answer' || type === 'math_equation'
    || (type === 'fill_blank' && opts.length === 0);
  const isTrueFalse = type === 'true_false' || (!opts.length && !type);

  return (
    <div>
      <div className="bg-white rounded-2xl sm:rounded-3xl p-5 sm:p-8 shadow-lg border-2 border-gray-100 mb-4 sm:mb-6 text-center">
        <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs sm:text-sm font-bold mb-3 sm:mb-4">
          Question {questionNumber}{type && type !== 'multiple_choice' ? ` · ${type.replace(/_/g, ' ')}` : ''}
        </span>
        <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-gray-900 mb-2 whitespace-pre-line">
          {question.text || question.question_text}
        </h2>
        {type === 'audio' && imgUrl && <audio controls className="mx-auto mt-4" src={imgUrl} />}
        {type !== 'audio' && type !== 'image_label' && imgUrl && (
          <img src={imgUrl} alt="" className="mt-4 max-h-48 mx-auto rounded-xl object-contain" />
        )}
      </div>

      {/* ── typed answers ─────────────────────────────────────────────────── */}
      {isTextual ? (
        <div className="max-w-lg mx-auto">
          {!answered ? (
            <form onSubmit={(e) => { e.preventDefault(); gradeTyped(); }} className="space-y-3">
              <input
                type={type === 'math_equation' ? 'number' : 'text'}
                step={type === 'math_equation' ? 'any' : undefined}
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                placeholder={type === 'math_equation' ? 'Enter your answer...' : 'Type your answer...'}
                autoFocus
                className="w-full px-4 sm:px-6 py-4 border-2 border-gray-200 rounded-2xl text-lg font-bold text-gray-900 focus:border-blue-500 focus:outline-none text-center"
              />
              <button type="submit" disabled={!typed.trim()}
                className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 disabled:opacity-40 text-lg">
                Submit
              </button>
            </form>
          ) : (
            <div className={`p-6 rounded-2xl border-2 text-center ${correct ? 'bg-green-100 border-green-500' : 'bg-red-100 border-red-500'}`}>
              <div className="flex items-center justify-center gap-2 mb-2">
                {correct ? <Check className="w-6 h-6 text-green-600" /> : <X className="w-6 h-6 text-red-600" />}
                <span className="font-black text-lg">{correct ? 'Correct' : 'Wrong'}</span>
              </div>
              <p className="text-sm text-gray-600">Your answer: <span className="font-bold">{picked}</span></p>
              {!correct && <p className="text-sm text-green-700 mt-1">Correct answer: <span className="font-bold">{String(question.correctAnswer)}</span></p>}
            </div>
          )}
        </div>

      /* ── multi-select ───────────────────────────────────────────────────── */
      ) : type === 'multi_select' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {opts.map((option, i) => {
            const letter = ['A', 'B', 'C', 'D'][i];
            const isC = String(question.correctAnswer || '').includes(letter);
            const sel = typed.includes(letter);
            return (
              <button key={i} disabled={answered}
                onClick={() => setTyped(cur => cur.includes(letter) ? cur.replace(letter, '') : cur + letter)}
                className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl text-left transition-all ${answered
                  ? isC ? 'bg-green-100 border-2 border-green-500' : sel ? 'bg-red-100 border-2 border-red-500' : 'bg-gray-50 border-2 border-gray-100 opacity-40'
                  : sel ? 'bg-blue-100 border-2 border-blue-500' : 'bg-white border-2 border-gray-200 hover:border-blue-500'}`}>
                <span className="flex items-center gap-3">{keycap(i + 1)}<span className="font-bold text-lg">{option}</span></span>
              </button>
            );
          })}
          {!answered && (
            <button onClick={() => gradeTyped()} disabled={!typed}
              className="sm:col-span-2 py-4 bg-blue-600 text-white font-black rounded-2xl disabled:opacity-40 text-lg">
              Submit Selection
            </button>
          )}
        </div>

      /* ── image labels ───────────────────────────────────────────────────── */
      ) : type === 'image_label' && Array.isArray(question.correctAnswer) ? (
        <div>
          <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 mb-4">
            {imgUrl && <img src={imgUrl} alt="" className="w-full max-h-72 object-contain" />}
            {question.correctAnswer.map((pin, i) => (
              <div key={i} style={{ position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg border-2 border-white ${answered ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>{i + 1}</div>
                {answered && <div className="absolute top-8 left-1/2 -translate-x-1/2 bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap">{pin.label}</div>}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {opts.map((label, i) => (
              <button key={i} disabled={answered} onClick={() => { setTyped(label); gradeTyped(label); }}
                className={`p-4 rounded-xl text-left transition-all ${answered
                  ? question.correctAnswer.some(p => p.label === label) ? 'bg-green-100 border-2 border-green-500' : 'bg-gray-50 border-2 border-gray-100 opacity-40'
                  : 'bg-white border-2 border-gray-200 hover:border-blue-500'}`}>
                <span className="flex items-center gap-3">{keycap(i + 1)}<span className="font-bold">{label}</span></span>
              </button>
            ))}
          </div>
        </div>

      /* ── ordering ───────────────────────────────────────────────────────── */
      ) : type === 'ordering' && Array.isArray(question.correctAnswer) ? (
        <div className="max-w-lg mx-auto">
          <p className="text-sm text-gray-500 font-semibold mb-3 text-center">Drag items to reorder them</p>
          <div className="space-y-2">
            {orderItems.map((item, i) => (
              <div key={`${item}-${i}`} draggable={!answered}
                onDragStart={() => setDragIdx(i)}
                onDragOver={e => { e.preventDefault(); setDragOverIdx(i); }}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={e => {
                  e.preventDefault();
                  if (dragIdx === null || dragIdx === i) return;
                  const next = [...orderItems];
                  next.splice(i, 0, next.splice(dragIdx, 1)[0]);
                  setOrderItems(next); setDragIdx(null); setDragOverIdx(null);
                }}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                className={`p-4 rounded-xl font-bold flex items-center gap-3 select-none ${answered
                  ? (item === question.correctAnswer[i] ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500')
                  : dragOverIdx === i ? 'bg-blue-100 border-2 border-blue-500'
                  : 'bg-white border-2 border-gray-200 cursor-grab'}`}>
                <span className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-black text-gray-500">{i + 1}</span>
                <span className="flex-1 text-gray-900">{item}</span>
                {answered && (item === question.correctAnswer[i]
                  ? <Check className="w-5 h-5 text-green-600" /> : <X className="w-5 h-5 text-red-600" />)}
              </div>
            ))}
          </div>
          {!answered && (
            <button onClick={() => gradeTyped('submit')} className="w-full mt-4 py-4 bg-blue-600 text-white font-black rounded-2xl text-lg">Submit Order</button>
          )}
        </div>

      /* ── matching ───────────────────────────────────────────────────────── */
      ) : type === 'matching' && Array.isArray(question.correctAnswer) ? (
        <div className="max-w-lg mx-auto">
          <p className="text-sm text-gray-500 font-semibold mb-3 text-center">Drag items from the right to match with the left</p>
          <div className="flex gap-4">
            <div className="flex-1 space-y-2">
              {question.correctAnswer.map((pair, i) => (
                <div key={i}
                  onDragOver={e => { e.preventDefault(); setDragOverLeft(pair.left); }}
                  onDragLeave={() => setDragOverLeft(null)}
                  onDrop={e => { e.preventDefault(); if (dragMatchItem) { setMatchSel(p => ({ ...p, [pair.left]: dragMatchItem })); setDragMatchItem(null); setDragOverLeft(null); } }}
                  className={`p-3 rounded-xl text-sm font-bold min-h-[52px] ${answered
                    ? matchSel[pair.left] === pair.right ? 'bg-green-100 border-2 border-green-500' : 'bg-red-100 border-2 border-red-500'
                    : dragOverLeft === pair.left ? 'bg-blue-100 border-2 border-blue-500' : 'bg-white border-2 border-gray-200'}`}>
                  <div>{pair.left}</div>
                  {matchSel[pair.left] && (
                    <div className="mt-1 text-xs font-semibold flex items-center gap-1 text-blue-600">
                      <span className="truncate">{matchSel[pair.left]}</span>
                      {/* Without this a mis-drop was permanent and the student was
                          locked into an answer they could see was wrong. */}
                      {!answered && (
                        <button type="button" aria-label="Remove match"
                          onClick={() => setMatchSel(prev => { const n = { ...prev }; delete n[pair.left]; return n; })}
                          className="ml-auto text-gray-400 hover:text-red-500 font-black px-1">&times;</button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex-1 space-y-2">
              {(question.rightOptions || []).map((opt, j) => {
                const used = Object.values(matchSel).includes(opt);
                return (
                  <div key={j} draggable={!answered && !used} onDragStart={() => setDragMatchItem(opt)}
                    className={`p-3 rounded-xl text-sm font-bold ${used ? 'bg-gray-100 border-2 border-gray-200 opacity-40' : 'bg-white border-2 border-gray-200 cursor-grab'}`}>
                    {opt}
                  </div>
                );
              })}
            </div>
          </div>
          {!answered && (() => {
            const done = question.correctAnswer.every(p => matchSel[p.left]);
            return (
              <button onClick={() => gradeTyped('submit')} disabled={!done}
                className="w-full mt-4 py-4 bg-blue-600 text-white font-black rounded-2xl text-lg disabled:opacity-40">
                {done ? 'Submit Matches' : `Match all ${question.correctAnswer.length} to submit`}
              </button>
            );
          })()}
        </div>

      /* ── true / false ───────────────────────────────────────────────────── */
      ) : isTrueFalse ? (
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          {['True', 'False'].map((label, idx) => {
            const isC = Number(question.correctAnswer) === idx || String(question.correctAnswer).toLowerCase() === label.toLowerCase();
            return (
              <button key={label} disabled={answered} onClick={() => gradeTrueFalse(idx)}
                className={`p-5 sm:p-7 rounded-xl sm:rounded-2xl text-center font-black text-2xl transition-all ${answered
                  ? isC ? 'bg-green-100 border-2 border-green-500 text-green-800'
                    : picked === idx ? 'bg-red-100 border-2 border-red-500 text-red-800'
                    : 'bg-gray-50 border-2 border-gray-100 opacity-40'
                  : 'bg-white border-2 border-gray-200 hover:border-red-500'}`}>
                <span className="inline-flex items-center gap-2.5">{keycap(idx + 1)}{label}</span>
              </button>
            );
          })}
        </div>

      /* ── multiple choice (default) ──────────────────────────────────────── */
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {opts.map((option, i) => (
            <button key={i} disabled={answered} onClick={() => gradeIndex(i)}
              className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl text-left transition-all ${answered
                ? (Number(question.correctAnswer) === i || String(question.correctAnswer).toLowerCase() === String(option).toLowerCase())
                  ? 'bg-green-100 border-2 border-green-500 text-green-800'
                  : picked === i ? 'bg-red-100 border-2 border-red-500 text-red-800'
                  : 'bg-gray-50 border-2 border-gray-100 opacity-40'
                : 'bg-white border-2 border-gray-200 hover:border-blue-500'}`}>
              <span className="flex items-center gap-3">{keycap(i + 1)}<span className="font-bold text-lg">{option}</span></span>
            </button>
          ))}
        </div>
      )}

      {answered && onNext && (
        <button onClick={onNext}
          className="w-full max-w-lg mx-auto mt-5 block py-3.5 bg-gray-900 text-white font-black rounded-2xl hover:bg-gray-800">
          {nextLabel}
        </button>
      )}
    </div>
  );
}
