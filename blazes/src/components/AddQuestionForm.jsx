import { useState, useRef } from 'react';
import { Plus, Lock, Music, Sigma } from 'lucide-react';

const MATH_SYMBOLS = [
  '+', '−', '×', '÷', '=', '≠', '≤', '≥', '<', '>',
  '±', '∓', '·', '∗', '√', '∛', '∜', '∞', 'π', 'τ',
  '°', '′', '″', 'Δ', '∑', '∏', '∫', '∮', '∂', '∇',
  '²', '³', '½', '¼', '¾', '⅓', '⅔', '⅛', '⅜', '⅝',
  '⁰', '¹', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹', '⁻', '⁺',
  '₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉',
  'α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'σ', 'φ', 'ω',
  '∈', '∉', '⊂', '⊃', '∪', '∩', '∅', '→', '↔', '⇒',
];

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// tier: 'free' | 'blazes_plus' | 'teacher_pro' | 'school'
// onUpgradePrompt: optional, called when user clicks a locked type
// onQuestionAdded: called after a question is created, with the refreshed kit
export default function AddQuestionForm({
  kit,
  tier = 'free',
  ownerEndpoint, // e.g. `kits/teacher/${user.id}` or `kits/student/${user.id}` — for refreshing the kit list
  onQuestionAdded,
  onUpgradePrompt,
}) {
  const [newQuestionType, setNewQuestionType] = useState('multiple_choice');
  const [newCorrect, setNewCorrect] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImagePreview, setNewImagePreview] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState('');
  const [showMathPicker, setShowMathPicker] = useState(false);
  const questionTextRef = useRef(null);

  const insertMathSymbol = (symbol) => {
    const el = questionTextRef.current;
    if (!el) return;
    const start = el.selectionStart || 0;
    const end = el.selectionEnd || 0;
    const newValue = el.value.slice(0, start) + symbol + el.value.slice(end);
    el.value = newValue;
    // Restore cursor position after the inserted symbol
    const pos = start + symbol.length;
    setTimeout(() => { el.focus(); el.setSelectionRange(pos, pos); }, 0);
  };

  const hasPremium = ['blazes_plus', 'teacher_pro', 'school'].includes(tier);

  const QUESTION_TYPES = [
    ['multiple_choice', 'Multiple Choice', false],
    ['true_false', 'True/False', false],
    ['short_answer', 'Short Answer', false],
    ['multi_select', 'Multi-Select', !hasPremium],
    ['matching', 'Matching', !hasPremium],
    ['ordering', 'Ordering', !hasPremium],
    ['audio', 'Audio', !hasPremium],
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const form = e.target;

    if (!form.question_text?.value?.trim()) { setError('Enter the question text'); return; }
    if (newQuestionType === 'multiple_choice' && !newCorrect) { setError('Select the correct answer (click A, B, C, or D)'); return; }
    if (newQuestionType === 'multi_select' && !newCorrect) { setError('Select at least one correct answer'); return; }
    if (newQuestionType === 'true_false' && !newCorrect) { setError('Select True or False'); return; }
    if (newQuestionType === 'short_answer' && !form.correct_text?.value?.trim()) { setError('Enter the correct answer'); return; }
    if (newQuestionType === 'audio' && !newImageUrl) { setError('Upload an audio file'); return; }
    if (newQuestionType === 'audio' && !newCorrect) { setError('Select the correct answer option'); return; }

    let correctAnswer = newCorrect;
    let imgUrl = newImageUrl || '';
    const optA = form.option_a?.value || '';
    const optB = form.option_b?.value || '';
    const optC = form.option_c?.value || '';
    const optD = form.option_d?.value || '';

    if (newQuestionType === 'short_answer') correctAnswer = form.correct_text.value;

    if (newQuestionType === 'ordering') {
      const items = [0, 1, 2, 3, 4, 5].map(i => form[`order_${i}`]?.value?.trim()).filter(Boolean);
      if (items.length < 2) { setError('Add at least 2 items to order'); return; }
      correctAnswer = items.join('|||');
    }
    if (newQuestionType === 'matching') {
      const pairs = [];
      for (let i = 0; i < 5; i++) {
        const l = form[`match_left_${i}`]?.value?.trim();
        const r = form[`match_right_${i}`]?.value?.trim();
        if (l && r) pairs.push(`${l}|||${r}`);
      }
      if (pairs.length < 2) { setError('Add at least 2 matching pairs'); return; }
      correctAnswer = pairs.join('###');
    }

    try {
      const res = await fetch(`${BASE}/api/kits/${kit.id}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: form.question_text.value,
          answer_type: newQuestionType,
          correct_answer: correctAnswer,
          option_a: optA, option_b: optB, option_c: optC, option_d: optD,
          image_url: imgUrl,
        }),
      });
      if (res.ok) {
        setNewImageUrl(''); setNewImagePreview('');
        const kitRes = await fetch(`${BASE}/api/kits/${kit.id}`);
        const kitData = await kitRes.json();
        let kitsList = null;
        if (ownerEndpoint) {
          try { kitsList = await (await fetch(`${BASE}/api/${ownerEndpoint}`)).json(); } catch (_) {}
        }
        if (onQuestionAdded) onQuestionAdded(kitData, kitsList);
        form.reset();
        setNewCorrect('');
        setNewQuestionType('multiple_choice');
      } else {
        setError('Failed to add question');
      }
    } catch (_) {
      setError('Could not connect to server');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const res = await fetch(`${BASE}/api/upload-image`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData: reader.result }),
        });
        const data = await res.json();
        if (data.url) { setNewImageUrl(data.url); setNewImagePreview(data.url); }
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (_) { setUploadingImage(false); }
    e.target.value = '';
  };

  const handleAudioUpload = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await fetch(`${BASE}/api/upload-audio`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ audioData: reader.result }),
        });
        const data = await res.json();
        if (data.url) { setNewImageUrl(data.url); setNewImagePreview(data.url); }
      } catch (_) {}
    };
    reader.readAsDataURL(file);
  };

  const isAudio = newQuestionType === 'audio';

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
      <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
        <Plus className="w-4 h-4 text-blue-600" /> Add New Question
      </h4>
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <div className="flex gap-2">
            <input
              ref={questionTextRef}
              name="question_text" required placeholder="Question text"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowMathPicker(!showMathPicker)}
              aria-label="Insert math symbol"
              className={`px-3 py-2 rounded-lg border text-sm font-bold transition-colors flex items-center gap-1.5 ${
                showMathPicker ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:border-gray-400'
              }`}
            >
              <Sigma className="w-4 h-4" /> Math
            </button>
          </div>
          {showMathPicker && (
            <div className="mt-2 bg-white border border-gray-200 rounded-lg p-2">
              <p className="text-[10px] font-bold text-gray-500 mb-1.5 px-1">Click to insert into question</p>
              <div className="grid grid-cols-10 gap-1">
                {MATH_SYMBOLS.map(sym => (
                  <button key={sym} type="button"
                    onClick={() => insertMathSymbol(sym)}
                    className="text-sm font-bold w-8 h-8 rounded hover:bg-blue-50 hover:text-blue-700 transition-colors text-gray-700 border border-transparent hover:border-blue-200">
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Type selector */}
        <div className="flex flex-wrap gap-1.5">
          {QUESTION_TYPES.map(([val, label, locked]) => (
            <button key={val} type="button"
              onClick={() => {
                if (locked) {
                  if (onUpgradePrompt) onUpgradePrompt();
                  else setError('This question type requires Blazes Plus or Teacher Pro');
                } else {
                  setNewQuestionType(val); setNewCorrect(''); setError('');
                }
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition-all flex items-center gap-1 ${
                locked
                  ? 'bg-purple-50 border-purple-200 text-purple-400 hover:border-purple-300'
                  : newQuestionType === val ? 'bg-blue-100 border-blue-400 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
              }`}>
              {label}{locked && <Lock className="w-2.5 h-2.5 opacity-60" />}
            </button>
          ))}
        </div>

        {/* Image upload (not for audio type) */}
        {!isAudio && (
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs font-bold text-gray-500 mb-2">Image (optional)</p>
            {newImagePreview && (
              <div className="relative mb-2">
                <img src={newImagePreview} alt="Preview" className="w-full max-h-32 object-contain rounded-lg bg-gray-100" />
                <button type="button" onClick={() => { setNewImageUrl(''); setNewImagePreview(''); }}
                  className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-black hover:bg-red-600">×</button>
              </div>
            )}
            <div className="flex gap-2">
              <input type="text" value={newImageUrl}
                onChange={(e) => { setNewImageUrl(e.target.value); setNewImagePreview(e.target.value); }}
                placeholder="Paste image URL..."
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-xs focus:border-blue-500 focus:outline-none" />
              <label className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${uploadingImage ? 'bg-gray-300 text-gray-500' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}>
                {uploadingImage ? '...' : 'Upload'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
            </div>
          </div>
        )}

        {/* Multiple choice */}
        {newQuestionType === 'multiple_choice' && (
          <>
            <p className="text-xs font-bold text-gray-500">Click an option to mark it as the correct answer</p>
            <div className="grid grid-cols-2 gap-2">
              {['A', 'B', 'C', 'D'].map(letter => (
                <div key={letter} className="relative">
                  <input name={`option_${letter.toLowerCase()}`} required={letter === 'A' || letter === 'B'}
                    placeholder={`Option ${letter}${letter === 'C' || letter === 'D' ? ' (optional)' : ''}`}
                    className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none border-2 transition-all ${newCorrect === letter ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'}`} />
                  <button type="button" onClick={() => setNewCorrect(newCorrect === letter ? '' : letter)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${newCorrect === letter ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {newCorrect === letter ? '✓' : letter}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* True/False */}
        {newQuestionType === 'true_false' && (
          <div className="flex gap-3">
            {['True', 'False'].map(v => (
              <button key={v} type="button" onClick={() => setNewCorrect(v)}
                className={`flex-1 py-3 rounded-xl font-bold border-2 transition-all ${newCorrect === v ? 'bg-green-50 border-green-400 text-green-700' : 'bg-white border-gray-200 text-gray-600'}`}>
                {v}
              </button>
            ))}
          </div>
        )}

        {/* Short answer */}
        {newQuestionType === 'short_answer' && (
          <input name="correct_text" required placeholder="Correct answer"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
        )}

        {/* Multi-select */}
        {newQuestionType === 'multi_select' && (
          <>
            <p className="text-xs font-bold text-gray-500">Click all correct answers</p>
            <div className="grid grid-cols-2 gap-2">
              {['A', 'B', 'C', 'D'].map(letter => (
                <div key={letter} className="relative">
                  <input name={`option_${letter.toLowerCase()}`} required={letter === 'A' || letter === 'B'}
                    placeholder={`Option ${letter}`}
                    className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none border-2 transition-all ${(newCorrect || '').includes(letter) ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'}`} />
                  <button type="button" onClick={() => setNewCorrect((newCorrect || '').includes(letter) ? (newCorrect || '').replace(letter, '') : (newCorrect || '') + letter)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded flex items-center justify-center text-xs font-black ${(newCorrect || '').includes(letter) ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {(newCorrect || '').includes(letter) ? '✓' : letter}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Matching */}
        {newQuestionType === 'matching' && (
          <>
            <p className="text-xs font-bold text-gray-500">Enter matching pairs</p>
            {[0, 1, 2, 3, 4].map(idx => (
              <div key={idx} className="flex items-center gap-2">
                <input name={`match_left_${idx}`} placeholder={`Item ${idx + 1}`} required={idx < 2}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
                <span className="text-gray-400 font-bold text-sm">→</span>
                <input name={`match_right_${idx}`} placeholder={`Match ${idx + 1}`} required={idx < 2}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            ))}
          </>
        )}

        {/* Ordering */}
        {newQuestionType === 'ordering' && (
          <>
            <p className="text-xs font-bold text-gray-500">Enter items in the correct order</p>
            {[0, 1, 2, 3, 4, 5].map(idx => (
              <div key={idx} className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">{idx + 1}</span>
                <input name={`order_${idx}`} placeholder={idx < 2 ? `Step ${idx + 1} (required)` : `Step ${idx + 1} (optional)`} required={idx < 2}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none" />
              </div>
            ))}
          </>
        )}

        {/* Audio */}
        {isAudio && (
          <>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <p className="text-xs font-bold text-gray-500 mb-2">Audio File *</p>
              {newImageUrl && (
                <div className="flex items-center gap-2 mb-2 bg-green-50 border border-green-200 rounded-lg p-2">
                  <audio controls src={newImageUrl} className="h-8 flex-1" />
                  <button type="button" onClick={() => { setNewImageUrl(''); setNewImagePreview(''); }}
                    className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-black">×</button>
                </div>
              )}
              <div
                className={`flex flex-col items-center justify-center rounded-lg text-xs font-bold cursor-pointer transition-all py-4 px-3 ${newImageUrl ? 'bg-gray-50 border-2 border-gray-200' : 'bg-blue-50 border-2 border-dashed border-blue-300 hover:bg-blue-100'}`}
                onDragOver={e => { e.preventDefault(); }}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files?.[0];
                  if (file && file.type.startsWith('audio/')) handleAudioUpload(file);
                }}
                onClick={() => document.getElementById('aqf-audio-upload')?.click()}
              >
                <Music className="w-6 h-6 mb-1 text-blue-600" />
                <span className={newImageUrl ? 'text-gray-500' : 'text-blue-700'}>
                  {newImageUrl ? 'Drop to replace' : 'Drop audio here or click'}
                </span>
                <span className="text-[10px] text-gray-400 mt-0.5">MP3, WAV, OGG</span>
                <input id="aqf-audio-upload" type="file" accept="audio/*" className="hidden"
                  onChange={(e) => handleAudioUpload(e.target.files?.[0])} />
              </div>
            </div>
            <p className="text-xs font-bold text-gray-500">Click the correct answer option</p>
            <div className="grid grid-cols-2 gap-2">
              {['A', 'B', 'C', 'D'].map(letter => (
                <div key={letter} className="relative">
                  <input name={`option_${letter.toLowerCase()}`} required={letter === 'A' || letter === 'B'}
                    placeholder={`Option ${letter}`}
                    className={`w-full px-3 py-2 rounded-lg text-sm focus:outline-none border-2 transition-all ${newCorrect === letter ? 'border-green-500 bg-green-50' : 'border-gray-300 bg-white'}`} />
                  <button type="button" onClick={() => setNewCorrect(newCorrect === letter ? '' : letter)}
                    className={`absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${newCorrect === letter ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {newCorrect === letter ? '✓' : letter}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {error && <p className="text-xs text-red-500 font-semibold">{error}</p>}

        <button type="submit"
          className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors text-sm">
          Add Question
        </button>
      </form>
    </div>
  );
}
