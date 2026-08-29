import { useState, useEffect, useRef } from 'react';
import { authHeaders } from '../utils/auth';
import {
  Plus, BookOpen, X, Trash2, ImagePlus, Pencil, Zap, Lock, ChevronDown,
  Clipboard, Lightbulb, FileText, FileSpreadsheet, Presentation, File,
  Globe, Link2, BookMarked, Library, Target, Loader2,
} from 'lucide-react';
import Toast from '../components/Toast';
import SubjectPicker, { GradePicker } from './SubjectPicker';
import ImagePicker from './ImagePicker';

// Every way a teacher can hand the AI generator something to work from.
// `kind` maps straight to the extractor on /api/ai/extract-file; `accept`
// is the file-picker filter for that kind. Grouped so the modal can lay
// them out by category instead of one long list.
const AI_IMPORT_GROUPS = [
  {
    label: 'Type or Paste', icon: Clipboard,
    options: [
      { id: 'paste', label: 'Paste Notes', icon: Clipboard },
      { id: 'topic', label: 'Just a Topic', icon: Lightbulb },
    ],
  },
  {
    label: 'Upload a File', icon: FileText,
    options: [
      { id: 'file', kind: 'pdf', accept: '.pdf', label: 'PDF', icon: FileText },
      { id: 'file', kind: 'docx', accept: '.docx', label: 'Word (.docx)', icon: FileText },
      { id: 'file', kind: 'pptx', accept: '.pptx', label: 'PowerPoint', icon: Presentation },
      { id: 'file', kind: 'xlsx', accept: '.xlsx', label: 'Excel', icon: FileSpreadsheet },
      { id: 'file', kind: 'csv', accept: '.csv', label: 'CSV', icon: FileSpreadsheet },
      { id: 'file', kind: 'txt', accept: '.txt', label: 'Plain Text', icon: File },
      { id: 'file', kind: 'md', accept: '.md,.markdown', label: 'Markdown', icon: File },
      { id: 'file', kind: 'rtf', accept: '.rtf', label: 'Rich Text', icon: File },
      { id: 'file', kind: 'html', accept: '.html,.htm', label: 'Webpage File', icon: Globe },
      { id: 'file', kind: 'epub', accept: '.epub', label: 'EPUB', icon: BookMarked },
      { id: 'file', kind: 'odt', accept: '.odt', label: 'OpenDocument', icon: FileText },
      { id: 'file', kind: 'json', accept: '.json', label: 'JSON Notes', icon: File },
      { id: 'file', kind: 'srt', accept: '.srt,.vtt', label: 'Subtitles / Transcript', icon: File },
    ],
  },
  {
    label: 'From the Web', icon: Globe,
    options: [
      { id: 'url', label: 'A Webpage', icon: Link2 },
      { id: 'wikipedia', label: 'Wikipedia', icon: Globe },
      { id: 'googledocs', label: 'Google Docs (published link)', icon: FileText },
    ],
  },
  {
    label: 'From Your Classes', icon: Library,
    options: [
      { id: 'existing_kit', label: 'An Existing Kit', icon: Library },
      { id: 'weak_spots', label: "Class's Weak Spots", icon: Target },
    ],
  },
];

// One dropdown implementation for the whole form: a button showing the
// current value, a chevron, and a list that closes on an outside click.
// Question count, difficulty, "which kit", "which classroom" all use this
// instead of each hand-rolling its own open state and native <select>.
function StyledSelect({ value, onChange, options, placeholder = 'Select...', empty }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);
  const selected = options.find(o => String(o.value) === String(value));
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(o => !o)}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm font-semibold bg-white hover:border-purple-300 transition-colors flex items-center justify-between gap-2">
        <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400 font-normal'}`}>{selected ? selected.label : placeholder}</span>
        <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden max-h-56 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2.5 text-sm text-gray-400">{empty || 'Nothing here yet'}</div>
          ) : options.map(o => (
            <button key={o.value} type="button" onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full px-3 py-2.5 text-sm font-semibold text-left hover:bg-purple-50 transition-colors ${
                String(value) === String(o.value) ? 'bg-purple-50 text-purple-700' : 'text-gray-700'
              }`}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CreateKit({ user, onBack, onKitCreated }) {
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
  const [userTier, setUserTier] = useState('free');

  useEffect(() => {
    if (!user?.id) return;
    fetch(`${base}/api/subscription/${user.id}`).then(r => r.json()).then(d => setUserTier(d.tier || 'free')).catch(() => {});
  }, [user, base]);

  const hasAI = ['blazes_plus', 'teacher_pro', 'school'].includes(userTier);
  const [kitDetails, setKitDetails] = useState({ title: '', subject: '', gradeLevel: '', description: '' });
  const [questions, setQuestions] = useState([]);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState({
    questionText: '', answerType: 'multiple_choice', correctAnswer: '', options: ['', '', '', ''], imageUrl: ''
  });
  const [editingIndex, setEditingIndex] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', type: 'error' });
  const [publishing, setPublishing] = useState(false);
  const [labelPins, setLabelPins] = useState([]);
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [aiCount, setAiCount] = useState(10);
  const [aiDifficulty, setAiDifficulty] = useState('medium');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiTypes, setAiTypes] = useState(['multiple_choice', 'true_false', 'multi_select', 'ordering', 'matching']);

  // Which of the 20 import options is active, and whatever small extra
  // input that source needs (a URL, a topic name, which kit/classroom).
  // aiNotes stays the one shared destination every source but weak_spots
  // fills, so Questions/Difficulty/Types/Generate below never need to
  // know which source produced the text.
  const [aiSource, setAiSource] = useState('paste');
  // Which of the 4 groups is expanded in the import picker. Showing one
  // group's options at a time instead of all 20 stacked keeps the picker
  // to a glance instead of a scroll.
  const [aiCategoryTab, setAiCategoryTab] = useState(AI_IMPORT_GROUPS[0].label);
  const [aiSourceLabel, setAiSourceLabel] = useState('');
  const [aiExtracting, setAiExtracting] = useState(false);
  const [aiUrlInput, setAiUrlInput] = useState('');
  const [aiTopicInput, setAiTopicInput] = useState('');
  const [aiWikiInput, setAiWikiInput] = useState('');
  const [aiExistingKits, setAiExistingKits] = useState(null);
  const [aiSelectedKitId, setAiSelectedKitId] = useState('');
  const [aiClassrooms, setAiClassrooms] = useState(null);
  const [aiSelectedClassroomId, setAiSelectedClassroomId] = useState('');
  const aiFileInputRef = useRef(null);
  const [aiPendingFileKind, setAiPendingFileKind] = useState('');

  // Resets everything about the import source, not the question
  // count/difficulty/types below it, those are independent of where the
  // text came from.
  const resetAiSource = () => {
    setAiSource('paste'); setAiCategoryTab(AI_IMPORT_GROUPS[0].label); setAiSourceLabel(''); setAiNotes(''); setAiError('');
    setAiUrlInput(''); setAiTopicInput(''); setAiWikiInput('');
    setAiSelectedKitId(''); setAiSelectedClassroomId('');
  };

  const pickAiOption = (opt) => {
    setAiError('');
    if (opt.id === 'file') {
      setAiPendingFileKind(opt.kind);
      if (aiFileInputRef.current) {
        aiFileInputRef.current.accept = opt.accept;
        aiFileInputRef.current.click();
      }
      return;
    }
    setAiSource(opt.id);
    setAiNotes('');
    setAiSourceLabel('');
    if (opt.id === 'existing_kit' && aiExistingKits === null) {
      fetch(`${base}/api/kits/teacher/${user.id}`).then(r => r.json()).then(setAiExistingKits).catch(() => setAiExistingKits([]));
    }
    if (opt.id === 'weak_spots' && aiClassrooms === null) {
      fetch(`${base}/api/classrooms/teacher/${user.id}`).then(r => r.json()).then(setAiClassrooms).catch(() => setAiClassrooms([]));
    }
  };

  const handleAiFileSelected = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAiSource('file');
    setAiError('');
    setAiExtracting(true);
    setAiNotes('');
    try {
      const buf = await file.arrayBuffer();
      const res = await fetch(`${base}/api/ai/extract-file?kind=${aiPendingFileKind}`, {
        method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: buf,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read that file');
      setAiNotes(data.text);
      setAiSourceLabel(`Uploaded: ${file.name}`);
    } catch (err) {
      setAiError(err.message || 'Could not read that file');
    }
    setAiExtracting(false);
  };

  const handleAiFetchUrl = async () => {
    if (!aiUrlInput.trim()) return;
    setAiError(''); setAiExtracting(true); setAiNotes('');
    try {
      const res = await fetch(`${base}/api/ai/extract-url`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: aiUrlInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read that page');
      setAiNotes(data.text);
      setAiSourceLabel(`From: ${aiUrlInput.trim()}`);
    } catch (err) {
      setAiError(err.message || 'Could not read that page');
    }
    setAiExtracting(false);
  };

  const handleAiFetchWikipedia = async () => {
    if (!aiWikiInput.trim()) return;
    setAiError(''); setAiExtracting(true); setAiNotes('');
    try {
      const res = await fetch(`${base}/api/ai/extract-wikipedia`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ topic: aiWikiInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not find that article');
      setAiNotes(data.text);
      setAiSourceLabel(`Wikipedia: ${data.title}`);
    } catch (err) {
      setAiError(err.message || 'Could not find that article');
    }
    setAiExtracting(false);
  };

  const handleAiLoadExistingKit = async (kitId) => {
    setAiSelectedKitId(kitId);
    if (!kitId) { setAiNotes(''); setAiSourceLabel(''); return; }
    setAiError(''); setAiExtracting(true); setAiNotes('');
    try {
      const res = await fetch(`${base}/api/kits/${kitId}`);
      const data = await res.json();
      const text = (data.questions || []).map(q => {
        let ans = q.correct_answer || '';
        if (q.answer_type === 'multiple_choice' && /^[A-D]$/i.test(ans)) {
          const opts = [q.option_a, q.option_b, q.option_c, q.option_d];
          ans = opts['ABCD'.indexOf(ans.toUpperCase())] || ans;
        }
        return `${q.question_text} (${ans})`;
      }).join('\n');
      if (!text.trim()) throw new Error('That kit has no questions to work from');
      setAiNotes(text);
      setAiSourceLabel(`From kit: ${data.title || 'Untitled'}`);
    } catch (err) {
      setAiError(err.message || 'Could not load that kit');
    }
    setAiExtracting(false);
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.questionText) { setToast({ show: true, message: 'Please fill in the question text', type: 'error' }); return; }
    if (currentQuestion.answerType === 'multiple_choice') {
      if (currentQuestion.options.filter(opt => opt.trim()).length < 2) { setToast({ show: true, message: 'Please add at least 2 options', type: 'error' }); return; }
      if (!currentQuestion.correctAnswer) { setToast({ show: true, message: 'Please select the correct answer', type: 'error' }); return; }
    } else if (currentQuestion.answerType === 'multi_select') {
      if (currentQuestion.options.filter(opt => opt.trim()).length < 2) { setToast({ show: true, message: 'Please add at least 2 options', type: 'error' }); return; }
      if (!currentQuestion.correctAnswer) { setToast({ show: true, message: 'Please select at least one correct answer', type: 'error' }); return; }
    } else if (currentQuestion.answerType === 'ordering') {
      if (currentQuestion.options.filter(opt => opt.trim()).length < 2) { setToast({ show: true, message: 'Please add at least 2 items to order', type: 'error' }); return; }
      currentQuestion.correctAnswer = currentQuestion.options.filter(o => o.trim()).join('|||');
    } else if (currentQuestion.answerType === 'matching') {
      const pairs = [];
      for (let i = 0; i < 10; i += 2) {
        if (currentQuestion.options[i]?.trim() && currentQuestion.options[i + 1]?.trim()) {
          pairs.push(`${currentQuestion.options[i].trim()}|||${currentQuestion.options[i + 1].trim()}`);
        }
      }
      if (pairs.length < 2) { setToast({ show: true, message: 'Please add at least 2 matching pairs', type: 'error' }); return; }
      currentQuestion.correctAnswer = pairs.join('###');
    } else if (currentQuestion.answerType === 'image_label') {
      const validPins = labelPins.filter(p => p.label.trim());
      if (validPins.length < 2) { setToast({ show: true, message: 'Please place at least 2 labeled pins on the image', type: 'error' }); return; }
      if (!currentQuestion.imageUrl) { setToast({ show: true, message: 'Please upload an image first', type: 'error' }); return; }
      // Store pins as JSON in correctAnswer, labels in options
      currentQuestion.correctAnswer = JSON.stringify(validPins);
      currentQuestion.options = validPins.map(p => p.label);
    } else if (currentQuestion.answerType === 'audio') {
      if (!currentQuestion.imageUrl) { setToast({ show: true, message: 'Please add an audio URL', type: 'error' }); return; }
      if (!currentQuestion.correctAnswer) { setToast({ show: true, message: 'Please select the correct answer', type: 'error' }); return; }
    } else if (!currentQuestion.correctAnswer) { setToast({ show: true, message: 'Please fill in the correct answer', type: 'error' }); return; }

    if (editingIndex !== null) {
      const updated = [...questions];
      updated[editingIndex] = currentQuestion;
      setQuestions(updated);
      setEditingIndex(null);
    } else {
      setQuestions([...questions, currentQuestion]);
    }
    resetQuestionForm();
    setShowQuestionModal(false);
  };

  const resetQuestionForm = () => {
    setCurrentQuestion({ questionText: '', answerType: 'multiple_choice', correctAnswer: '', options: ['', '', '', ''], imageUrl: '' });
    setLabelPins([]);
  };

  const handlePublishKit = async () => {
    if (publishing) return; // prevent double-click double-create
    if (!kitDetails.title || !kitDetails.subject) { setToast({ show: true, message: 'Please fill in kit title and subject', type: 'error' }); return; }
    if (questions.length === 0) { setToast({ show: true, message: 'Please add at least one question', type: 'error' }); return; }
    setPublishing(true);
    try {
      const kitRes = await fetch(`${base}/api/kits/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: user.id, title: kitDetails.title, subject: kitDetails.subject, gradeLevel: kitDetails.gradeLevel, description: kitDetails.description })
      });
      const kitData = await kitRes.json();
      if (!kitRes.ok) { setToast({ show: true, message: 'Error: ' + kitData.error, type: 'error' }); setPublishing(false); return; }
      // Bulk-insert all questions in one round-trip. Used to be a sequential
      // for-await loop that paid per-call latency × N; now flat ~200ms.
      const payload = questions.map(q => ({
        question_text: q.questionText,
        answer_type: q.answerType,
        correct_answer: q.correctAnswer,
        image_url: q.imageUrl || '',
        option_a: q.options[0] || '',
        option_b: q.options[1] || '',
        option_c: q.options[2] || '',
        option_d: q.options[3] || '',
      }));
      const bulkRes = await fetch(`${base}/api/kits/${kitData.kitId}/questions/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: payload }),
      });
      if (!bulkRes.ok) {
        const e = await bulkRes.json().catch(() => ({}));
        setToast({ show: true, message: 'Error saving questions: ' + (e.error || 'unknown'), type: 'error' });
        setPublishing(false);
        return;
      }
      setToast({ show: true, message: 'Kit published successfully!', type: 'success' });
      setKitDetails({ title: '', subject: '', gradeLevel: '', description: '' });
      setQuestions([]);
      if (onKitCreated) onKitCreated(); else if (onBack) onBack();
    } catch (_) {
      setToast({ show: true, message: 'Failed to publish kit.', type: 'error' });
    } finally {
      setPublishing(false);
    }
  };

  const letters = ['A', 'B', 'C', 'D'];

  return (
    <div className="max-w-3xl mx-auto">
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900 mb-2">Create Question Kit</h1>
        <p className="text-gray-500">Build a new set of questions for your students</p>
      </div>

      {/* Kit Details */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 lg:p-10 shadow-sm border border-gray-200 mb-8">
        <h3 className="text-lg font-black text-gray-900 mb-6">Kit Details</h3>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Kit Name *</label>
            <input type="text" value={kitDetails.title}
              onChange={(e) => setKitDetails({...kitDetails, title: e.target.value})}
              placeholder="e.g., Algebra Basics Quiz"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors" />
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Subject *</label>
              <SubjectPicker value={kitDetails.subject} onChange={(v) => setKitDetails({...kitDetails, subject: v})} />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1.5">Grade Level <span className="text-gray-400 font-normal">(optional)</span></label>
              <GradePicker value={kitDetails.gradeLevel} onChange={(v) => setKitDetails({...kitDetails, gradeLevel: v})} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1.5">Description <span className="text-gray-400 font-normal">(optional)</span></label>
            <textarea value={kitDetails.description}
              onChange={(e) => setKitDetails({...kitDetails, description: e.target.value})}
              placeholder="Brief description of this question kit..."
              rows={2}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors resize-none" />
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 lg:p-10 shadow-sm border border-gray-200 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-3 sm:gap-0">
          <div>
            <h3 className="text-lg font-black text-gray-900">Questions</h3>
            <p className="text-sm text-gray-500 mt-0.5">{questions.length} question{questions.length !== 1 ? 's' : ''} added</p>
          </div>
          <div className="flex gap-2">
            {hasAI ? (
              <button onClick={() => { resetAiSource(); setShowAIModal(true); }}
                className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-purple-700 transition-colors">
                <Zap className="w-4 h-4" /> AI Generate
              </button>
            ) : (
              <button onClick={() => window.location.href = '/upgrade'}
                className="relative flex items-center gap-2 bg-gradient-to-r from-purple-500 to-indigo-500 text-white px-4 py-2.5 rounded-xl font-bold text-sm cursor-pointer hover:from-purple-600 hover:to-indigo-600 transition-all overflow-hidden"
                style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}>
                <div className="absolute inset-0 locked-shimmer" />
                <Zap className="w-4 h-4 relative z-10" />
                <span className="relative z-10">AI Generate</span>
                <Lock className="w-3 h-3 relative z-10 opacity-70" />
              </button>
            )}
            <button onClick={() => { setEditingIndex(null); resetQuestionForm(); setShowQuestionModal(true); }}
              className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-red-700 transition-colors flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Question
            </button>
          </div>
        </div>

        {questions.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 font-semibold mb-1">No questions yet</p>
            <p className="text-gray-400 text-sm">Click "Add Question" to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {questions.map((q, index) => (
              <div key={index} className="group p-5 border-2 border-gray-100 rounded-2xl hover:border-gray-200 hover:shadow-sm transition-all bg-gray-50/50">
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-red-600 text-sm font-black">{index + 1}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 leading-relaxed">{q.questionText}</p>
                    {q.imageUrl && <img src={q.imageUrl} alt="" className="mt-3 max-h-24 rounded-lg object-contain bg-white border border-gray-200" />}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {q.answerType === 'multiple_choice' || q.answerType === 'audio' ? (
                        q.options.filter(o => o).map((o, i) => (
                          <span key={i} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${letters[i] === q.correctAnswer ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-gray-100 text-gray-600'}`}>
                            {letters[i]}) {o}
                          </span>
                        ))
                      ) : q.answerType === 'true_false' ? (
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold ring-1 ring-green-300">
                          {q.correctAnswer}
                        </span>
                      ) : q.answerType === 'multi_select' ? (
                        q.options.filter(o => o).map((o, i) => {
                          const isCorrect = (q.correctAnswer || '').toUpperCase().includes(letters[i]);
                          return (
                            <span key={i} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${isCorrect ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-gray-100 text-gray-600'}`}>
                              {letters[i]}) {o}
                            </span>
                          );
                        })
                      ) : q.answerType === 'ordering' ? (
                        (q.correctAnswer || '').split('|||').filter(Boolean).map((item, i) => (
                          <span key={i} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold ring-1 ring-blue-200">
                            {i + 1}. {item}
                          </span>
                        ))
                      ) : q.answerType === 'matching' ? (
                        (q.correctAnswer || '').split('###').filter(Boolean).map((pair, i) => {
                          const [left, right] = pair.split('|||');
                          return (
                            <span key={i} className="px-2.5 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold ring-1 ring-purple-200">
                              {left?.trim()} → {right?.trim()}
                            </span>
                          );
                        })
                      ) : q.answerType === 'fill_blank' ? (
                        q.options && q.options.filter(o => o).length > 0 ? (
                          q.options.filter(o => o).map((o, i) => (
                            <span key={i} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${letters[i] === q.correctAnswer ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-gray-100 text-gray-600'}`}>
                              {letters[i]}) {o}
                            </span>
                          ))
                        ) : (
                          <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold ring-1 ring-green-300">
                            {q.correctAnswer}
                          </span>
                        )
                      ) : (
                        <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-bold ring-1 ring-green-300">
                          {q.correctAnswer}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setCurrentQuestion(q); setEditingIndex(index); setShowQuestionModal(true); }}
                      className="p-2 hover:bg-white rounded-lg transition-colors">
                      <Pencil className="w-4 h-4 text-gray-500" />
                    </button>
                    <button onClick={() => setQuestions(questions.filter((_, i) => i !== index))}
                      className="p-2 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-4 mb-12">
        <button onClick={onBack}
          className="flex-1 bg-gray-100 text-gray-700 py-4 rounded-xl font-bold hover:bg-gray-200 transition-colors">
          Back
        </button>
        <button onClick={handlePublishKit} disabled={publishing}
          className="flex-1 bg-gradient-to-r from-red-600 to-orange-500 text-white py-4 rounded-xl font-bold hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed">
          {publishing ? 'Publishing...' : 'Publish Kit'}
        </button>
      </div>

      {/* Add/Edit Question Modal */}
      {showQuestionModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-xl shadow-2xl max-h-[90vh] overflow-y-auto">
            {/* Modal header */}
            <div className="sticky top-0 bg-white border-b border-gray-100 px-4 sm:px-6 md:px-8 py-5 flex items-center justify-between rounded-t-3xl z-10">
              <h2 className="text-xl font-black text-gray-900">{editingIndex !== null ? 'Edit Question' : 'New Question'}</h2>
              <button onClick={() => { setShowQuestionModal(false); setEditingIndex(null); }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="px-4 sm:px-6 md:px-8 py-6 space-y-6">
              {/* Question text */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Question *</label>
                <textarea value={currentQuestion.questionText}
                  onChange={(e) => setCurrentQuestion({...currentQuestion, questionText: e.target.value})}
                  placeholder="Enter your question..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors resize-none" />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <ImagePlus className="w-4 h-4 text-gray-400" /> Image
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <ImagePicker
                  value={currentQuestion.imageUrl}
                  onChange={(url) => setCurrentQuestion({ ...currentQuestion, imageUrl: url })}
                  searchQuery={currentQuestion.questionText}
                  onError={(msg) => setToast({ show: true, message: msg, type: 'error' })}
                />
              </div>

              {/* Answer type tabs */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Answer Type</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    ['multiple_choice', 'Multiple Choice', false],
                    ['true_false', 'True / False', false],
                    ['short_answer', 'Short Answer', false],
                    ['multi_select', 'Multi-Select', !hasAI],
                    ['matching', 'Matching', !hasAI],
                    ['ordering', 'Ordering', !hasAI],
                    ['image_label', 'Image Label', !hasAI],
                    ['audio', 'Audio', !hasAI],
                  ].map(([val, label, locked]) => (
                    <button key={val} type="button"
                      onClick={() => {
                        if (locked) {
                          setToast({ show: true, message: 'Unlock 5 more question types with Blazes Plus', type: 'info' });
                          setTimeout(() => window.location.href = '/upgrade', 1500);
                        } else {
                          setCurrentQuestion({...currentQuestion, answerType: val, options: val === 'ordering' ? ['', '', '', ''] : ['', '', '', ''], correctAnswer: ''});
                        }
                      }}
                      className={`relative px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 ${
                        locked
                          ? 'bg-purple-50 border-purple-200 text-purple-400 hover:border-purple-300'
                          : currentQuestion.answerType === val
                            ? 'bg-red-50 border-red-300 text-red-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                      }`}>
                      <span className={locked ? 'opacity-70' : ''}>{label}</span>
                      {locked && <Lock className="w-2.5 h-2.5 inline ml-1 opacity-60" />}
                    </button>
                  ))}
                </div>
                {!hasAI && (
                  <button onClick={() => window.location.href = '/upgrade'}
                    className="mt-2 text-xs font-bold text-purple-500 hover:text-purple-700 transition-colors flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Unlock all question types with Blazes Plus
                  </button>
                )}
              </div>

              {/* Multiple choice options */}
              {currentQuestion.answerType === 'multiple_choice' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Options *</label>
                  <p className="text-xs text-gray-400 mb-3">Tap the circle to mark the correct answer</p>
                  <div className="space-y-3">
                    {letters.map((letter, idx) => (
                      <div key={letter} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        currentQuestion.correctAnswer === letter
                          ? 'border-green-400 bg-green-50'
                          : 'border-gray-200 bg-white'
                      }`}>
                        <button type="button"
                          onClick={() => setCurrentQuestion({...currentQuestion, correctAnswer: currentQuestion.correctAnswer === letter ? '' : letter})}
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-black transition-all flex-shrink-0 ${
                            currentQuestion.correctAnswer === letter
                              ? 'bg-green-500 text-white shadow-md shadow-green-200'
                              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                          }`}>
                          {currentQuestion.correctAnswer === letter ? '✓' : letter}
                        </button>
                        <input type="text" value={currentQuestion.options[idx] || ''}
                          onChange={(e) => {
                            const opts = [...currentQuestion.options];
                            opts[idx] = e.target.value;
                            setCurrentQuestion({...currentQuestion, options: opts});
                          }}
                          placeholder={`Option ${letter}${idx >= 2 ? ' (optional)' : ''}`}
                          className="flex-1 px-3 py-2 bg-transparent focus:outline-none text-sm font-medium text-gray-900 placeholder-gray-400" />
                      </div>
                    ))}
                  </div>
                  {!currentQuestion.correctAnswer && (
                    <p className="text-xs text-red-500 font-semibold mt-2">Select the correct answer above</p>
                  )}
                </div>
              )}

              {/* True/False */}
              {currentQuestion.answerType === 'true_false' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Correct Answer *</label>
                  <div className="flex gap-3">
                    {['True', 'False'].map(v => (
                      <button key={v} type="button"
                        onClick={() => setCurrentQuestion({...currentQuestion, correctAnswer: v})}
                        className={`flex-1 py-3.5 rounded-xl font-bold transition-all border-2 ${
                          currentQuestion.correctAnswer === v
                            ? 'bg-green-50 border-green-400 text-green-700 shadow-sm shadow-green-100'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Short answer */}
              {currentQuestion.answerType === 'short_answer' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Correct Answer *</label>
                  <input type="text" value={currentQuestion.correctAnswer}
                    onChange={(e) => setCurrentQuestion({...currentQuestion, correctAnswer: e.target.value})}
                    placeholder="Enter correct answer"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors" />
                </div>
              )}

              {/* Multi-select (premium) */}
              {currentQuestion.answerType === 'multi_select' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Options * <span className="text-gray-400 font-normal">(tap all correct answers)</span></label>
                  <div className="space-y-2 mt-2">
                    {letters.map((letter, idx) => {
                      const selected = (currentQuestion.correctAnswer || '').includes(letter);
                      return (
                        <div key={letter} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${selected ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                          <button type="button"
                            onClick={() => {
                              const cur = currentQuestion.correctAnswer || '';
                              const next = selected ? cur.replace(letter, '') : cur + letter;
                              setCurrentQuestion({...currentQuestion, correctAnswer: next});
                            }}
                            className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${selected ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                            {selected ? '✓' : letter}
                          </button>
                          <input type="text" value={currentQuestion.options[idx] || ''}
                            onChange={e => { const o = [...currentQuestion.options]; o[idx] = e.target.value; setCurrentQuestion({...currentQuestion, options: o}); }}
                            placeholder={`Option ${letter}`}
                            className="flex-1 px-3 py-2 bg-transparent focus:outline-none text-sm font-medium" />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Fill in the blank (premium) */}
              {currentQuestion.answerType === 'fill_blank' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Correct Answer *</label>
                  <p className="text-xs text-gray-400 mb-2">Use ___ in the question text to show where the blank is</p>
                  <input type="text" value={currentQuestion.correctAnswer}
                    onChange={e => setCurrentQuestion({...currentQuestion, correctAnswer: e.target.value})}
                    placeholder="The word that fills the blank"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none" />
                </div>
              )}

              {/* Ordering (premium) */}
              {currentQuestion.answerType === 'ordering' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Items in correct order *</label>
                  <p className="text-xs text-gray-400 mb-2">Enter items in the correct order. Players will see them shuffled.</p>
                  <div className="space-y-2">
                    {[0, 1, 2, 3, 4, 5].map(idx => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 flex-shrink-0">{idx + 1}</span>
                        <input type="text" value={currentQuestion.options[idx] || ''}
                          onChange={e => { const o = [...currentQuestion.options]; o[idx] = e.target.value; setCurrentQuestion({...currentQuestion, options: o}); }}
                          placeholder={idx < 2 ? `Step ${idx + 1} (required)` : `Step ${idx + 1} (optional)`}
                          className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-500 focus:outline-none" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Matching (premium) */}
              {currentQuestion.answerType === 'matching' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Matching Pairs *</label>
                  <p className="text-xs text-gray-400 mb-2">Enter pairs. Left side matched to right side. Players see them shuffled.</p>
                  <div className="space-y-2">
                    {[0, 1, 2, 3, 4].map(idx => (
                      <div key={idx} className="flex items-center gap-2">
                        <input type="text" value={(currentQuestion.options[idx * 2] || '')}
                          onChange={e => { const o = [...currentQuestion.options]; o[idx * 2] = e.target.value; setCurrentQuestion({...currentQuestion, options: o}); }}
                          placeholder={`Item ${idx + 1}`}
                          className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-500 focus:outline-none" />
                        <span className="text-gray-400 font-bold">→</span>
                        <input type="text" value={(currentQuestion.options[idx * 2 + 1] || '')}
                          onChange={e => { const o = [...currentQuestion.options]; o[idx * 2 + 1] = e.target.value; setCurrentQuestion({...currentQuestion, options: o}); }}
                          placeholder={`Match ${idx + 1}`}
                          className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-500 focus:outline-none" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Image labeling (premium). Click to place pins */}
              {currentQuestion.answerType === 'image_label' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Place Labels on Image *</label>
                  <p className="text-xs text-gray-400 mb-2">Upload an image above first, then click on the image to place pins. Type a label for each pin.</p>

                  {currentQuestion.imageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border-2 border-gray-200 mb-3 cursor-crosshair"
                      onClick={(e) => {
                        if (labelPins.length >= 6) return;
                        const rect = e.currentTarget.getBoundingClientRect();
                        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
                        setLabelPins([...labelPins, { x, y, label: '' }]);
                      }}>
                      <img src={currentQuestion.imageUrl.startsWith('http') || currentQuestion.imageUrl.startsWith('data:') ? currentQuestion.imageUrl : `${base}${currentQuestion.imageUrl.startsWith('/') ? '' : '/'}${currentQuestion.imageUrl}`}
                        alt="" className="w-full max-h-64 object-contain" draggable={false} />
                      {/* Pins */}
                      {labelPins.map((pin, i) => (
                        <div key={i} style={{ position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)' }}>
                          <div className="flex flex-col items-center">
                            <div className="bg-red-600 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shadow-lg border-2 border-white">
                              {i + 1}
                            </div>
                            <div className="w-0.5 h-2 bg-red-600" />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gray-100 rounded-xl p-4 sm:p-6 md:p-8 text-center border-2 border-dashed border-gray-300 mb-3">
                      <p className="text-gray-400 font-semibold text-sm">Upload an image first using the image section above</p>
                    </div>
                  )}

                  {/* Pin labels */}
                  {labelPins.length > 0 && (
                    <div className="space-y-2">
                      {labelPins.map((pin, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className="w-7 h-7 bg-red-600 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">{i + 1}</div>
                          <input type="text" value={pin.label}
                            onChange={e => {
                              const p = [...labelPins];
                              p[i] = { ...p[i], label: e.target.value };
                              setLabelPins(p);
                            }}
                            placeholder={`Label for pin ${i + 1} (e.g., "Mitochondria")`}
                            className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-500 focus:outline-none" />
                          <button type="button" onClick={() => setLabelPins(labelPins.filter((_, j) => j !== i))}
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {labelPins.length > 0 && labelPins.length < 6 && (
                    <p className="text-xs text-gray-400 mt-2">Click the image to add more pins ({6 - labelPins.length} remaining)</p>
                  )}
                  {labelPins.length === 0 && currentQuestion.imageUrl && (
                    <p className="text-xs text-gray-400 mt-2">Click anywhere on the image to place a pin</p>
                  )}
                </div>
              )}

              {/* Audio question (premium) */}
              {currentQuestion.answerType === 'audio' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Audio File *</label>
                  <p className="text-xs text-gray-400 mb-2">Upload an audio file. Players will listen and choose the correct answer.</p>
                  {currentQuestion.imageUrl && (
                    <div className="flex items-center gap-2 mb-3 bg-green-50 border border-green-200 rounded-xl p-3">
                      <audio controls src={currentQuestion.imageUrl.startsWith('http') || currentQuestion.imageUrl.startsWith('data:') ? currentQuestion.imageUrl : `${base}${currentQuestion.imageUrl.startsWith('/') ? '' : '/'}${currentQuestion.imageUrl}`} className="h-8 flex-1" />
                      <button type="button" onClick={() => setCurrentQuestion({...currentQuestion, imageUrl: ''})}
                        className="w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-black">×</button>
                    </div>
                  )}
                  <div
                    className={`relative flex flex-col items-center justify-center rounded-xl text-sm font-bold cursor-pointer transition-all mb-4 py-6 px-4 ${currentQuestion.imageUrl ? 'bg-gray-50 border-2 border-gray-200' : 'bg-red-50 border-2 border-dashed border-red-300 hover:bg-red-100'}`}
                    onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('border-red-500', 'bg-red-100'); }}
                    onDragLeave={e => { e.preventDefault(); e.currentTarget.classList.remove('border-red-500', 'bg-red-100'); }}
                    onDrop={async e => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-red-500', 'bg-red-100');
                      const file = e.dataTransfer.files?.[0];
                      if (!file || !file.type.startsWith('audio/')) return;
                      const reader = new FileReader();
                      reader.onload = async () => {
                        try {
                          const res = await fetch(`${base}/api/upload-audio`, {
                            method: 'POST', headers: authHeaders(),
                            body: JSON.stringify({ audioData: reader.result })
                          });
                          const data = await res.json();
                          if (data.url) setCurrentQuestion(prev => ({...prev, imageUrl: data.url}));
                        } catch (_) {}
                      };
                      reader.readAsDataURL(file);
                    }}
                    onClick={() => document.getElementById('audio-upload-input')?.click()}
                  >
                    <div className={`text-2xl mb-1 ${currentQuestion.imageUrl ? 'text-gray-400' : 'text-red-400'}`}>🎵</div>
                    <span className={currentQuestion.imageUrl ? 'text-gray-500' : 'text-red-700'}>
                      {currentQuestion.imageUrl ? 'Drop to replace' : 'Drop audio file here or click to upload'}
                    </span>
                    <span className="text-xs text-gray-400 mt-1">MP3, WAV, OGG</span>
                    <input id="audio-upload-input" type="file" accept="audio/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async () => {
                        try {
                          const res = await fetch(`${base}/api/upload-audio`, {
                            method: 'POST', headers: authHeaders(),
                            body: JSON.stringify({ audioData: reader.result })
                          });
                          const data = await res.json();
                          if (data.url) setCurrentQuestion(prev => ({...prev, imageUrl: data.url}));
                        } catch (_) {}
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }} />
                  </div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Options & Correct Answer *</label>
                  <div className="space-y-2">
                    {letters.map((letter, idx) => (
                      <div key={letter} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                        currentQuestion.correctAnswer === letter ? 'border-green-400 bg-green-50' : 'border-gray-200'
                      }`}>
                        <button type="button"
                          onClick={() => setCurrentQuestion({...currentQuestion, correctAnswer: currentQuestion.correctAnswer === letter ? '' : letter})}
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                            currentQuestion.correctAnswer === letter ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-500'
                          }`}>
                          {currentQuestion.correctAnswer === letter ? '✓' : letter}
                        </button>
                        <input type="text" value={currentQuestion.options[idx] || ''}
                          onChange={e => { const o = [...currentQuestion.options]; o[idx] = e.target.value; setCurrentQuestion({...currentQuestion, options: o}); }}
                          placeholder={`Option ${letter}`}
                          className="flex-1 px-3 py-2 bg-transparent focus:outline-none text-sm font-medium" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 sm:px-6 md:px-8 py-5 flex gap-3 rounded-b-3xl">
              <button onClick={() => { setShowQuestionModal(false); setEditingIndex(null); }}
                className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                Cancel
              </button>
              <button onClick={handleAddQuestion}
                className="flex-1 bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors">
                {editingIndex !== null ? 'Update Question' : 'Add Question'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Generate Modal */}
      {showAIModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !aiLoading && setShowAIModal(false)}>
          <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-black text-gray-900 mb-2">AI Quiz Generator</h2>
            <p className="text-gray-500 text-sm mb-6">Pick where to pull material from, or paste your own notes</p>

            {aiError && (
              <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm font-semibold">
                {aiError}
              </div>
            )}

            <input ref={aiFileInputRef} type="file" className="hidden" onChange={handleAiFileSelected} />

            <div className="space-y-5">
              {/* Import from: 4 category tabs, one group's options visible
                  at a time instead of all 20 stacked at once. */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Import From</label>
                <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-2.5">
                  {AI_IMPORT_GROUPS.map(group => {
                    const TabIcon = group.icon;
                    const isActiveTab = aiCategoryTab === group.label;
                    return (
                      <button key={group.label} type="button" onClick={() => setAiCategoryTab(group.label)}
                        className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition-colors ${
                          isActiveTab ? 'bg-white text-purple-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}>
                        <TabIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="hidden sm:inline truncate">{group.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {AI_IMPORT_GROUPS.find(g => g.label === aiCategoryTab).options.map((opt, i) => {
                    const OptIcon = opt.icon;
                    const active = opt.id === 'file' ? (aiSource === 'file' && aiPendingFileKind === opt.kind) : aiSource === opt.id;
                    return (
                      <button key={opt.kind || opt.id + i} type="button" onClick={() => pickAiOption(opt)}
                        className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-bold text-left transition-colors border-2 ${
                          active ? 'bg-purple-50 text-purple-700 border-purple-300' : 'bg-white text-gray-600 border-gray-200 hover:border-purple-200 hover:bg-purple-50/50'
                        }`}>
                        <OptIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Source-specific small input, only for sources that need one */}
              {aiSource === 'topic' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Topic</label>
                  <input type="text" value={aiTopicInput}
                    onChange={e => { setAiTopicInput(e.target.value); setAiNotes(e.target.value.trim() ? `Topic: ${e.target.value.trim()}. Generate quiz questions testing understanding of this topic.` : ''); setAiSourceLabel(e.target.value.trim() ? `Topic: ${e.target.value.trim()}` : ''); }}
                    placeholder="e.g. The causes and effects of World War 1"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none" />
                </div>
              )}
              {aiSource === 'url' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Webpage URL</label>
                  <div className="flex gap-2">
                    <input type="text" value={aiUrlInput} onChange={e => setAiUrlInput(e.target.value)}
                      placeholder="https://..."
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none" />
                    <button type="button" onClick={handleAiFetchUrl} disabled={aiExtracting || !aiUrlInput.trim()}
                      className="px-4 py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 disabled:opacity-50">
                      Fetch
                    </button>
                  </div>
                </div>
              )}
              {aiSource === 'googledocs' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Google Docs Link</label>
                  <p className="text-xs text-gray-400 mb-1.5">File → Share → Publish to web, then paste that link here.</p>
                  <div className="flex gap-2">
                    <input type="text" value={aiUrlInput} onChange={e => setAiUrlInput(e.target.value)}
                      placeholder="https://docs.google.com/document/d/.../pub"
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none" />
                    <button type="button" onClick={handleAiFetchUrl} disabled={aiExtracting || !aiUrlInput.trim()}
                      className="px-4 py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 disabled:opacity-50">
                      Fetch
                    </button>
                  </div>
                </div>
              )}
              {aiSource === 'wikipedia' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Wikipedia Topic</label>
                  <div className="flex gap-2">
                    <input type="text" value={aiWikiInput} onChange={e => setAiWikiInput(e.target.value)}
                      placeholder="e.g. Photosynthesis"
                      className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none" />
                    <button type="button" onClick={handleAiFetchWikipedia} disabled={aiExtracting || !aiWikiInput.trim()}
                      className="px-4 py-3 bg-purple-600 text-white rounded-xl font-bold text-sm hover:bg-purple-700 disabled:opacity-50">
                      Fetch
                    </button>
                  </div>
                </div>
              )}
              {aiSource === 'existing_kit' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Which Kit?</label>
                  <StyledSelect
                    value={aiSelectedKitId}
                    onChange={handleAiLoadExistingKit}
                    placeholder="Select a kit..."
                    empty="You don't have any other kits yet."
                    options={(aiExistingKits || []).map(k => ({ value: k.id, label: `${k.title} (${k.question_count} questions)` }))}
                  />
                </div>
              )}
              {aiSource === 'weak_spots' && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Which Class?</label>
                  <StyledSelect
                    value={aiSelectedClassroomId}
                    onChange={setAiSelectedClassroomId}
                    placeholder="Select a classroom..."
                    empty="You don't have any classrooms yet."
                    options={(aiClassrooms || []).map(c => ({ value: c.id, label: c.name }))}
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Generates fresh practice questions covering whatever this class has gotten wrong most.</p>
                </div>
              )}

              {aiExtracting && (
                <div className="flex items-center gap-2 text-sm font-semibold text-purple-600">
                  <Loader2 className="w-4 h-4 animate-spin" /> Reading...
                </div>
              )}

              {/* The shared destination every source but weak_spots fills */}
              {aiSource !== 'weak_spots' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-700">Your Notes *</label>
                    {aiSourceLabel && <span className="text-xs font-semibold text-purple-600 truncate max-w-[60%]">{aiSourceLabel}</span>}
                  </div>
                  <textarea
                    value={aiNotes}
                    onChange={e => setAiNotes(e.target.value)}
                    placeholder="Paste your class notes, textbook content, or study material here, or pick a source above..."
                    rows={6}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl text-sm focus:border-purple-500 focus:outline-none resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{aiNotes.length} characters</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Questions</label>
                  <StyledSelect value={aiCount} onChange={v => setAiCount(Number(v))}
                    options={[5, 10, 15, 20].map(n => ({ value: n, label: `${n} questions` }))} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Difficulty</label>
                  <StyledSelect value={aiDifficulty} onChange={setAiDifficulty}
                    options={[{ value: 'easy', label: 'Easy' }, { value: 'medium', label: 'Medium' }, { value: 'hard', label: 'Hard' }]} />
                </div>
              </div>

              {/* Question types */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">Question Types</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'multiple_choice', label: 'Multiple Choice' },
                    { value: 'true_false', label: 'True / False' },
                    { value: 'multi_select', label: 'Select All' },
                    { value: 'ordering', label: 'Ordering' },
                    { value: 'matching', label: 'Matching' },
                  ].map(t => {
                    const active = aiTypes.includes(t.value);
                    return (
                      <button key={t.value} type="button"
                        onClick={() => setAiTypes(prev => active ? prev.filter(x => x !== t.value) : [...prev, t.value])}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${active ? 'bg-purple-100 text-purple-700 border border-purple-300' : 'bg-gray-100 text-gray-400 border border-gray-200'}`}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
                {aiTypes.length === 0 && <p className="text-xs text-red-500 mt-1 font-semibold">Select at least one type</p>}
              </div>

            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={() => { setShowAIModal(false); setAiError(''); }}
                disabled={aiLoading}
                className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 disabled:opacity-50">
                Cancel
              </button>
              <button
                onClick={async () => {
                  const isWeakSpots = aiSource === 'weak_spots';
                  if (isWeakSpots) {
                    if (!aiSelectedClassroomId) { setAiError('Pick a classroom first'); return; }
                  } else if (aiNotes.trim().length < 20) {
                    setAiError('Please provide at least 20 characters of notes');
                    return;
                  }
                  setAiLoading(true);
                  setAiError('');
                  try {
                    const res = await fetch(`${base}/api/ai/${isWeakSpots ? 'generate-from-weak-spots' : 'generate-from-notes'}`, {
                      method: 'POST',
                      headers: authHeaders(),
                      body: JSON.stringify(isWeakSpots
                        ? { classroomId: aiSelectedClassroomId, questionCount: aiCount, difficulty: aiDifficulty, questionTypes: aiTypes }
                        : { notes: aiNotes, questionCount: aiCount, difficulty: aiDifficulty, questionTypes: aiTypes })
                    });
                    const data = await res.json();
                    if (!res.ok) {
                      if (data.error === 'upgrade_required') {
                        setAiError('\uD83D\uDD12 ' + data.message);
                        setAiLoading(false);
                        return;
                      }
                      throw new Error(data.error || 'Generation failed');
                    }
                    const newQuestions = (data.questions || []).map(q => ({
                      questionText: q.question_text,
                      answerType: q.answer_type,
                      correctAnswer: q.correct_answer,
                      options: [q.option_a || '', q.option_b || '', q.option_c || '', q.option_d || ''],
                      imageUrl: ''
                    }));
                    setQuestions(prev => [...prev, ...newQuestions]);
                    setShowAIModal(false);
                    resetAiSource();
                    setToast({ show: true, message: `AI generated ${newQuestions.length} questions!`, type: 'success' });
                  } catch (err) {
                    setAiError(err.message || 'Failed to generate questions');
                  }
                  setAiLoading(false);
                }}
                disabled={aiLoading || aiExtracting || (aiSource === 'weak_spots' ? !aiSelectedClassroomId : aiNotes.trim().length < 20) || aiTypes.length === 0}
                className="flex-1 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {aiLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                  </>
                ) : (
                  'Generate Questions'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
