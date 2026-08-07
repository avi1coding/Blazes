import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { Flame, Users, Plus, Trash2, ArrowLeft, BookOpen, Clock, Check, X, ClipboardList, Play } from 'lucide-react';
import { AvatarPreview, cacheTier } from './SkinsPage';
import StyledSelect from '../components/StyledSelect';
import Toast from '../components/Toast';

export default function ClassroomPage() {
  const { classroomId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  // Parsed once — a fresh object each render would give every effect below a new
  // dependency identity, re-firing them forever and hammering the API.
  const user = useMemo(() => JSON.parse(localStorage.getItem('user') || 'null'), []);
  const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

  const [classroom, setClassroom] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [myAssignments, setMyAssignments] = useState([]);
  const [tab, setTab] = useState('assignments');
  const [emailInput, setEmailInput] = useState('');
  const [emailTags, setEmailTags] = useState([]);
  const [addResult, setAddResult] = useState(null);
  const [kits, setKits] = useState([]);
  const [showCreateAssignment, setShowCreateAssignment] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState({ kitId: '', title: '', instructions: '', dueDate: '', dueTime: '', minQuestions: '', minAccuracy: '' });
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [playerSkins, setPlayerSkins] = useState({});
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [deleteClassroomConfirm, setDeleteClassroomConfirm] = useState(false);
  const [showEditClassroom, setShowEditClassroom] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', subject: '', gradeLevel: '', imageUrl: '' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const [deleteAssignmentConfirm, setDeleteAssignmentConfirm] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [startingId, setStartingId] = useState(null);
  // Ref, not the state above: setState is async, so clicks dispatched before the
  // re-render would all read startingId === null and each fire a request.
  const startingRef = useRef(false);
  const [creatingAssignment, setCreatingAssignment] = useState(false);
  const [showInlineKit, setShowInlineKit] = useState(false);
  const [inlineKit, setInlineKit] = useState({ title: '', subject: '' });
  const [savingKit, setSavingKit] = useState(false);

  // Due date bounds: today through one year out (matches the validation in
  // validateAssignment, and lets the native picker grey out the rest).
  const todayStr = new Date().toISOString().slice(0, 10);
  const maxDateStr = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const fetchClassroom = () => fetch(`${base}/api/classrooms/${classroomId}`).then(r => r.json()).then(data => {
    setClassroom(data);
    (data.students || []).forEach(s => {
      if (playerSkins[s.id] !== undefined) return;
      fetch(`${base}/api/skins/${s.id}`).then(r => r.json()).then(d => {
        if (d.equipped?.avatar_skin) setPlayerSkins(prev => ({ ...prev, [s.id]: d.equipped.avatar_skin }));
        if (d.tier) cacheTier(s.id, d.tier);
      }).catch(() => {});
    });
  }).catch(() => {});
  const fetchAssignments = () => fetch(`${base}/api/classrooms/${classroomId}/assignments`).then(r => r.json()).then(setAssignments).catch(() => {});

  useEffect(() => {
    fetchClassroom();
    fetchAssignments();
    if (user?.role === 'teacher') {
      fetch(`${base}/api/kits/teacher/${user.id}`).then(r => r.json()).then(setKits).catch(() => {});
    }
    if (user?.role === 'student') {
      fetch(`${base}/api/assignments/student/${user.id}?t=${Date.now()}`).then(r => r.json()).then(d => {
        setMyAssignments((d || []).filter(a => String(a.classroom_id) === String(classroomId)));
      }).catch(() => {});
    }
  }, [classroomId, user]);

  // Refetch student assignments when page comes into view to show completion updates
  useEffect(() => {
    if (user?.role === 'student' && classroomId) {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const interval = setInterval(() => {
        fetch(`${base}/api/assignments/student/${user.id}?t=${Date.now()}`).then(r => r.json()).then(d => {
          setMyAssignments((d || []).filter(a => String(a.classroom_id) === String(classroomId)));
        }).catch(() => {});
      }, 2000); // Refetch every 2 seconds to catch updates
      return () => clearInterval(interval);
    }
  }, [classroomId, user]);

  const handleAddStudents = async () => {
    if (!emailInput.trim()) return;
    const emails = emailInput.split(/[,\n]/).map(e => e.trim()).filter(Boolean);
    const res = await fetch(`${base}/api/classrooms/${classroomId}/students`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails })
    });
    const data = await res.json();
    setAddResult(data);
    setEmailInput('');
    fetchClassroom();
  };

  const handleRemoveStudent = async (studentId) => {
    await fetch(`${base}/api/classrooms/${classroomId}/students/${studentId}`, { method: 'DELETE' });
    setRemoveConfirm(null);
    fetchClassroom();
  };

  // Returns a { field: message } map — empty means valid. Each field is checked
  // on its own so the error names only what's actually missing.
  const validateAssignment = (form) => {
    const errors = {};

    if (!form.title.trim()) errors.title = 'Give the assignment a title.';
    if (!form.kitId) errors.kitId = 'Pick a question kit, or create one below.';

    const min = Number(form.minQuestions);
    if (form.minQuestions === '' ) errors.minQuestions = 'Set how many questions to answer.';
    else if (!Number.isInteger(min) || min < 1) errors.minQuestions = 'Must be a whole number of 1 or more.';

    if (form.minAccuracy !== '') {
      const acc = Number(form.minAccuracy);
      if (!Number.isInteger(acc) || acc < 1 || acc > 100) errors.minAccuracy = 'Must be between 1 and 100.';
    }

    // Time without a date has nothing to anchor to.
    if (form.dueTime && !form.dueDate) errors.dueDate = 'Pick a date to go with the time.';

    if (form.dueDate) {
      // No time given means "any time that day", so the deadline is end of day.
      const due = new Date(`${form.dueDate}T${form.dueTime || '23:59'}`);
      if (Number.isNaN(due.getTime())) {
        errors.dueDate = 'That date is not valid.';
      } else {
        const oneYearOut = new Date();
        oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);
        if (due.getTime() < Date.now()) {
          // Always report under Due Date — that's the field people look at, even
          // when it's the time-of-day that pushed the deadline into the past.
          errors.dueDate = 'Due date is in the past.';
        } else if (due > oneYearOut) {
          errors.dueDate = 'Due date cannot be more than a year away.';
        }
      }
    }

    return errors;
  };

  const handleCreateAssignment = async () => {
    const errors = validateAssignment(assignmentForm);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      const labels = { title: 'Title', kitId: 'Question Kit', minQuestions: 'Min Questions', minAccuracy: 'Min Accuracy', dueDate: 'Due Date', dueTime: 'Due Time' };
      const named = Object.keys(errors).map(k => labels[k]).join(', ');
      setToast({ show: true, message: `Check these fields: ${named}`, type: 'error' });
      return;
    }

    const requirements = { min_questions: parseInt(assignmentForm.minQuestions, 10) };
    if (assignmentForm.minAccuracy) requirements.min_accuracy = parseInt(assignmentForm.minAccuracy, 10);

    setCreatingAssignment(true);
    try {
      const res = await fetch(`${base}/api/classrooms/${classroomId}/assignments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kitId: parseInt(assignmentForm.kitId, 10), title: assignmentForm.title.trim(), instructions: assignmentForm.instructions, dueDate: assignmentForm.dueDate || null, dueTime: assignmentForm.dueTime || null, requirements })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Previously the response was ignored, so a rejected create looked identical to a successful one.
        setToast({ show: true, message: data.message || data.error || 'Could not create the assignment.', type: 'error' });
        return;
      }
      setShowCreateAssignment(false);
      setFormErrors({});
      setAssignmentForm({ kitId: '', title: '', instructions: '', dueDate: '', dueTime: '', minQuestions: '', minAccuracy: '' });
      setToast({ show: true, message: 'Assignment created', type: 'success' });
      fetchAssignments();
    } catch {
      setToast({ show: true, message: 'Network error — assignment not created.', type: 'error' });
    } finally {
      setCreatingAssignment(false);
    }
  };

  // Create a kit without leaving the assignment form, then select it.
  const handleCreateInlineKit = async () => {
    if (!inlineKit.title.trim()) {
      setToast({ show: true, message: 'Give the kit a title', type: 'error' });
      return;
    }
    setSavingKit(true);
    try {
      const res = await fetch(`${base}/api/kits/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: user.id, title: inlineKit.title.trim(), subject: inlineKit.subject.trim() || classroom?.subject || '', gradeLevel: classroom?.grade_level || '', description: '' })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setToast({ show: true, message: data.message || data.error || 'Could not create the kit.', type: 'error' });
        return;
      }
      const fresh = await fetch(`${base}/api/kits/teacher/${user.id}`).then(r => r.json()).catch(() => null);
      if (fresh) setKits(fresh);
      setAssignmentForm(f => ({ ...f, kitId: String(data.kitId) }));
      setFormErrors(e => ({ ...e, kitId: undefined }));
      setInlineKit({ title: '', subject: '' });
      setShowInlineKit(false);
      setToast({ show: true, message: 'Kit created and selected — add questions to it from Kits', type: 'success' });
    } catch {
      setToast({ show: true, message: 'Network error — kit not created.', type: 'error' });
    } finally {
      setSavingKit(false);
    }
  };

  const handleDeleteAssignment = async (id) => {
    await fetch(`${base}/api/assignments/${id}`, { method: 'DELETE' });
    setDeleteAssignmentConfirm(null);
    fetchAssignments();
  };

  const viewAssignment = async (id) => {
    const res = await fetch(`${base}/api/assignments/${id}`);
    setSelectedAssignment(await res.json());
  };

  if (!classroom) return <div className="min-h-screen flex items-center justify-center"><Flame className="w-12 h-12 text-red-500 animate-pulse" /></div>;

  const isTeacher = user?.role === 'teacher';

  return (
    <div className="min-h-screen bg-gray-50">
      <Toast show={toast.show} message={toast.message} type={toast.type} onClose={() => setToast({ ...toast, show: false })} />
      
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => {
              if (location.key !== 'default') navigate(-1);
              else navigate(isTeacher ? '/home/teacher?tab=classrooms' : '/home/student?tab=classrooms');
            }} className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-black text-gray-900">{classroom.name}</h1>
              <p className="text-sm text-gray-500">{classroom.subject}{classroom.grade_level ? ` · ${classroom.grade_level}` : ''} · {(classroom.students || []).filter(s => s.status === 'accepted').length} students</p>
            </div>
          </div>
          {isTeacher && (
            <div className="flex items-center gap-2">
              <button onClick={() => {
                setEditForm({ name: classroom.name || '', subject: classroom.subject || '', gradeLevel: classroom.grade_level || '', imageUrl: classroom.image_url || '' });
                setShowEditClassroom(true);
              }} className="text-sm bg-gray-100 text-gray-700 px-4 py-2 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                Edit
              </button>
              <button onClick={() => setDeleteClassroomConfirm(true)}
                className="text-sm bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold hover:bg-red-100 transition-colors flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* Classroom banner image */}
      {classroom.image_url && (
        <div className="w-full h-40 sm:h-52 overflow-hidden">
          <img src={classroom.image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button onClick={() => setTab('students')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === 'students' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            <Users className="w-4 h-4 inline mr-1.5" />Students
          </button>
          <button onClick={() => setTab('assignments')} className={`px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${tab === 'assignments' ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            <ClipboardList className="w-4 h-4 inline mr-1.5" />Assignments
          </button>
        </div>

        {/* STUDENTS TAB */}
        {tab === 'students' && (
          <div>
            {isTeacher && (
              <div className="bg-white rounded-2xl p-6 border border-gray-200 mb-6">
                <h3 className="font-bold text-gray-900 mb-1">Add Students</h3>
                <p className="text-xs text-gray-500 mb-3">Type an email and press Enter or Space to add. Paste multiple emails at once.</p>

                {/* Tag-style email input */}
                <div className="border-2 border-gray-200 rounded-xl p-2 focus-within:border-red-500 transition-colors min-h-[52px] flex flex-wrap gap-2 items-start mb-3 cursor-text"
                  onClick={() => document.getElementById('email-tag-input')?.focus()}>
                  {emailTags.map((email, i) => (
                    <span key={i} className="inline-flex items-center gap-1.5 bg-blue-100 text-blue-800 px-3 py-1.5 rounded-lg text-sm font-semibold animate-in">
                      {email}
                      <button type="button" onClick={(e) => { e.stopPropagation(); setEmailTags(prev => prev.filter((_, j) => j !== i)); }}
                        className="text-blue-500 hover:text-blue-700 font-black text-xs leading-none">×</button>
                    </span>
                  ))}
                  <input
                    id="email-tag-input"
                    type="text"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ' || e.key === ',') && emailInput.trim()) {
                        e.preventDefault();
                        const newEmails = emailInput.split(/[,\s]+/).map(s => s.trim().toLowerCase()).filter(s => s.includes('@') && !emailTags.includes(s));
                        if (newEmails.length) setEmailTags(prev => [...prev, ...newEmails]);
                        setEmailInput('');
                      }
                      if (e.key === 'Backspace' && !emailInput && emailTags.length) {
                        setEmailTags(prev => prev.slice(0, -1));
                      }
                    }}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text');
                      const newEmails = pasted.split(/[,\s\n]+/).map(s => s.trim().toLowerCase()).filter(s => s.includes('@') && !emailTags.includes(s));
                      if (newEmails.length) setEmailTags(prev => [...prev, ...newEmails]);
                    }}
                    onBlur={() => {
                      if (emailInput.trim() && emailInput.includes('@')) {
                        setEmailTags(prev => [...prev, emailInput.trim().toLowerCase()]);
                        setEmailInput('');
                      }
                    }}
                    placeholder={emailTags.length === 0 ? "student@school.edu" : ""}
                    className="flex-1 min-w-[200px] px-2 py-1.5 text-sm outline-none bg-transparent"
                  />
                </div>

                {emailTags.length > 0 && (
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-500 font-semibold">{emailTags.length} email{emailTags.length !== 1 ? 's' : ''} ready to add</span>
                    <button onClick={() => setEmailTags([])} className="text-xs text-gray-400 hover:text-gray-600 font-semibold">Clear all</button>
                  </div>
                )}

                <button onClick={() => {
                  // Combine tags + any remaining input
                  let allEmails = [...emailTags];
                  if (emailInput.trim() && emailInput.includes('@')) allEmails.push(emailInput.trim().toLowerCase());
                  if (!allEmails.length) return;
                  setEmailInput('');
                  // Use the existing handler but with tags
                  const handler = async () => {
                    const res = await fetch(`${base}/api/classrooms/${classroomId}/students`, {
                      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ emails: allEmails })
                    });
                    const data = await res.json();
                    setAddResult(data);
                    setEmailTags([]);
                    fetchClassroom();
                  };
                  handler();
                }} disabled={emailTags.length === 0 && !emailInput.trim()}
                  className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-700 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                  <Plus className="w-4 h-4" /> Add {emailTags.length || ''} Student{emailTags.length !== 1 ? 's' : ''}
                </button>
                {addResult && (
                  <div className="mt-3 text-sm">
                    {addResult.added > 0 && <p className="text-green-600 font-semibold">{addResult.added} student(s) added</p>}
                    {addResult.notFound?.length > 0 && <p className="text-red-600 font-semibold">Not found: {addResult.notFound.join(', ')}</p>}
                  </div>
                )}
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <div className="px-4 sm:px-6 py-4 border-b border-gray-100">
                <h3 className="font-black text-gray-900">{classroom.students?.length || 0} Students</h3>
              </div>
              {(classroom.students || []).length === 0 ? (
                <div className="p-8 text-center text-gray-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-30" /><p>No students yet</p></div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {classroom.students.map(s => (
                    <div key={s.id} className="flex items-center gap-4 px-4 sm:px-6 py-3.5 hover:bg-gray-50">
                      <AvatarPreview skinId={playerSkins[s.id] || 'default'} initial={s.name?.[0]?.toUpperCase() || '?'} size={38} userId={s.id} />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-gray-900 text-sm truncate">{s.name}</div>
                        <div className="text-xs text-gray-500">{s.email}</div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${s.status === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {s.status === 'accepted' ? 'Joined' : 'Pending'}
                      </span>
                      {isTeacher && (
                        <button onClick={() => setRemoveConfirm(s)} className="text-xs bg-red-50 text-red-600 p-2 rounded-lg hover:bg-red-100">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ASSIGNMENTS TAB */}
        {tab === 'assignments' && (
          <div>
            {isTeacher && (
              <button onClick={() => setShowCreateAssignment(true)} className="mb-6 bg-red-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-red-700 flex items-center gap-2">
                <Plus className="w-4 h-4" /> New Assignment
              </button>
            )}

            {/* Student view: show my assignments with Start/Status */}
            {!isTeacher && myAssignments.length > 0 && (
              <div className="space-y-3 mb-6">
                {myAssignments.map(a => {
                  const reqs = a.requirements || {};
                  const overdue = a.due_date && new Date(a.due_date) < new Date();
                  const isDone = a.status === 'completed';
                  return (
                    <div key={a.id} className={`bg-white rounded-2xl p-5 border-2 ${isDone ? 'border-green-200' : overdue ? 'border-red-200' : 'border-gray-200'}`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-black text-gray-900">{a.title}</h3>
                            {isDone && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-bold">DONE</span>}
                            {!isDone && overdue && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">OVERDUE</span>}
                            {!isDone && !overdue && a.status === 'in_progress' && <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold">IN PROGRESS</span>}
                          </div>
                          <p className="text-sm text-gray-500">{a.kit_title} &middot; Classic Quiz</p>
                          {a.instructions && <p className="text-sm text-gray-600 mt-1">{a.instructions}</p>}
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            {a.due_date && <span><Clock className="w-3 h-3 inline mr-1" />Due: {new Date(a.due_date).toLocaleDateString()}</span>}
                            {reqs.min_questions && <span>Answer {reqs.min_questions} question{reqs.min_questions !== 1 ? 's' : ''}</span>}
                            {reqs.min_accuracy && <span>Min {reqs.min_accuracy}% accuracy</span>}
                          </div>
                          {!isDone && reqs.min_questions && (
                            <div className="mt-3">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-semibold text-gray-600">Progress: {a.questions_answered || 0}/{reqs.min_questions}</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div className="bg-red-600 h-2 rounded-full transition-all" style={{ width: `${Math.min(100, ((a.questions_answered || 0) / reqs.min_questions) * 100)}%` }}></div>
                              </div>
                            </div>
                          )}
                          {isDone && <p className="text-xs text-green-600 font-semibold mt-2">{a.questions_answered}q answered &middot; {a.correct_answers > 0 && a.questions_answered > 0 ? Math.round((a.correct_answers / a.questions_answered) * 100) : 0}% accuracy &middot; {a.score}pts</p>}
                        </div>
                        {!isDone && (
                          <button disabled={startingId !== null} onClick={async () => {
                            // Guard against a second click: the first click navigates away,
                            // which aborts any in-flight request and surfaces as the bare
                            // "Failed to fetch" TypeError rather than a real server error.
                            if (startingRef.current) return;
                            startingRef.current = true;
                            setStartingId(a.id);
                            try {
                              const res = await fetch(`${base}/api/assignments/${a.id}/play`, {
                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ studentId: user.id })
                              });
                              const data = await res.json().catch(() => ({}));
                              if (!res.ok) throw new Error(data.error || `Server returned ${res.status}`);
                              if (!data.gameCode) throw new Error('No game code returned');
                              localStorage.setItem('activeAssignment', JSON.stringify({ assignmentId: a.id, gameCode: data.gameCode }));
                              navigate(`/game/play/${data.gameCode}`);
                            } catch (err) {
                              const msg = err instanceof TypeError
                                ? 'Could not reach the server. Check your connection and try again.'
                                : err.message;
                              setToast({ show: true, message: 'Failed to start: ' + msg, type: 'error' });
                              startingRef.current = false;
                              setStartingId(null);
                            }
                          }}
                            className="bg-red-600 text-white px-5 py-2 rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-60 flex items-center gap-1.5 flex-shrink-0">
                            <Play className="w-4 h-4" /> {startingId === a.id ? 'Starting...' : (a.status === 'in_progress' ? 'Continue' : 'Start')}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!isTeacher && myAssignments.length === 0 && (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-semibold">No assignments yet</p>
              </div>
            )}

            {/* Parenthesised deliberately: `isTeacher && x === 0 ? a : b` parses as
                `(isTeacher && x === 0) ? a : b`, so a student fell into the else
                branch and saw the teacher's list on top of their own. */}
            {isTeacher && (assignments.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-200">
                <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-semibold">No assignments yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {assignments.map(a => {
                  const reqs = typeof a.requirements === 'string' ? JSON.parse(a.requirements) : (a.requirements || {});
                  const overdue = a.due_date && new Date(a.due_date) < new Date();
                  return (
                    <div key={a.id} className="bg-white rounded-2xl p-5 border border-gray-200 hover:shadow-sm transition-all">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-black text-gray-900">{a.title}</h3>
                            {overdue && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">OVERDUE</span>}
                          </div>
                          <p className="text-sm text-gray-500 mb-2">{a.kit_title} &middot; {a.game_mode?.replace('_', ' ')}</p>
                          {a.instructions && <p className="text-sm text-gray-600 mb-2">{a.instructions}</p>}
                          <div className="flex items-center gap-4 text-xs text-gray-500">
                            {a.due_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />Due: {new Date(a.due_date).toLocaleDateString()}</span>}
                            {reqs.min_questions && <span>Min {reqs.min_questions} questions</span>}
                            {reqs.min_accuracy && <span>Min {reqs.min_accuracy}% accuracy</span>}
                          </div>
                          {/* Progress bar */}
                          <div className="flex items-center gap-3 mt-3">
                            <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden max-w-xs">
                              <div className="h-full bg-green-500 rounded-full" style={{ width: `${a.total_count > 0 ? (a.completed_count / a.total_count) * 100 : 0}%` }} />
                            </div>
                            <span className="text-xs font-bold text-gray-500">{a.completed_count}/{a.total_count} completed</span>
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button onClick={() => viewAssignment(a.id)} className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100">View</button>
                          {isTeacher && <button onClick={() => setDeleteAssignmentConfirm(a)} className="text-xs bg-red-50 text-red-600 px-3 py-1.5 rounded-lg font-bold hover:bg-red-100"><Trash2 className="w-3 h-3" /></button>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Assignment Modal */}
      {showCreateAssignment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCreateAssignment(false)}>
          {/* Column layout with a scrolling body: the form is taller than a short
              viewport, and without this the fields and buttons were clipped. */}
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <div className="px-4 sm:px-6 md:px-8 pt-6 pb-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-2xl font-black text-gray-900">New Assignment</h2>
              <button onClick={() => setShowCreateAssignment(false)} aria-label="Close"
                className="p-2 -mr-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4 overflow-y-auto px-4 sm:px-6 md:px-8 py-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Title *</label>
                <input type="text" value={assignmentForm.title} onChange={e => setAssignmentForm({ ...assignmentForm, title: e.target.value })}
                  placeholder="e.g., Chapter 5 Review"
                  className={`w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none ${formErrors.title ? 'border-red-500' : 'border-gray-200 focus:border-red-500'}`} />
                {formErrors.title && <p className="text-xs text-red-600 font-semibold mt-1">{formErrors.title}</p>}
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-bold text-gray-700">Question Kit *</label>
                  <button type="button" onClick={() => setShowInlineKit(v => !v)}
                    className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" />{showInlineKit ? 'Cancel' : 'New kit'}
                  </button>
                </div>
                <StyledSelect
                  value={assignmentForm.kitId}
                  onChange={v => { setAssignmentForm({ ...assignmentForm, kitId: v }); setFormErrors(e => ({ ...e, kitId: undefined })); }}
                  placeholder={kits.length ? 'Select a kit...' : 'No kits yet — create one'}
                  options={kits.map(k => ({ value: String(k.id), label: `${k.title} (${k.question_count} q)` }))}
                />
                {formErrors.kitId && <p className="text-xs text-red-600 font-semibold mt-1">{formErrors.kitId}</p>}
                {showInlineKit && (
                  <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-2">
                    <input type="text" value={inlineKit.title} onChange={e => setInlineKit({ ...inlineKit, title: e.target.value })}
                      placeholder="Kit title" className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-500 focus:outline-none" />
                    <input type="text" value={inlineKit.subject} onChange={e => setInlineKit({ ...inlineKit, subject: e.target.value })}
                      placeholder={`Subject (default: ${classroom?.subject || 'none'})`} className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:border-red-500 focus:outline-none" />
                    <button type="button" onClick={handleCreateInlineKit} disabled={savingKit}
                      className="w-full py-2 bg-red-600 text-white font-bold rounded-lg text-sm hover:bg-red-700 disabled:opacity-60">
                      {savingKit ? 'Creating...' : 'Create kit'}
                    </button>
                    <p className="text-xs text-gray-500">Creates an empty kit and selects it. Add questions from the Kits page.</p>
                  </div>
                )}
              </div>
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                <p className="text-sm font-bold text-gray-700">Game Mode: <span className="text-red-600">Classic Quiz</span></p>
                <p className="text-xs text-gray-600 mt-1">Currently only Classic Quiz assignments are available.</p>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Instructions</label>
                <textarea value={assignmentForm.instructions} onChange={e => setAssignmentForm({ ...assignmentForm, instructions: e.target.value })}
                  placeholder="Any instructions for students..." rows={2}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-red-500 focus:outline-none resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Due Date</label>
                  <input type="date" value={assignmentForm.dueDate} min={todayStr} max={maxDateStr}
                    onChange={e => { setAssignmentForm({ ...assignmentForm, dueDate: e.target.value }); setFormErrors(er => ({ ...er, dueDate: undefined, dueTime: undefined })); }}
                    className={`w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none ${formErrors.dueDate ? 'border-red-500' : 'border-gray-200 focus:border-red-500'}`} />
                  {formErrors.dueDate && <p className="text-xs text-red-600 font-semibold mt-1">{formErrors.dueDate}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Due Time</label>
                  <input type="time" value={assignmentForm.dueTime}
                    onChange={e => { setAssignmentForm({ ...assignmentForm, dueTime: e.target.value }); setFormErrors(er => ({ ...er, dueDate: undefined, dueTime: undefined })); }}
                    className={`w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none ${formErrors.dueTime ? 'border-red-500' : 'border-gray-200 focus:border-red-500'}`} />
                  {formErrors.dueTime && <p className="text-xs text-red-600 font-semibold mt-1">{formErrors.dueTime}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Min Questions to Answer *</label>
                  <input type="number" value={assignmentForm.minQuestions}
                    onChange={e => { setAssignmentForm({ ...assignmentForm, minQuestions: e.target.value }); setFormErrors(er => ({ ...er, minQuestions: undefined })); }}
                    placeholder="e.g., 30" min="1" step="1"
                    className={`w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none ${formErrors.minQuestions ? 'border-red-500' : 'border-gray-200 focus:border-red-500'}`} />
                  {formErrors.minQuestions && <p className="text-xs text-red-600 font-semibold mt-1">{formErrors.minQuestions}</p>}
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Min Accuracy %</label>
                  <input type="number" value={assignmentForm.minAccuracy}
                    onChange={e => { setAssignmentForm({ ...assignmentForm, minAccuracy: e.target.value }); setFormErrors(er => ({ ...er, minAccuracy: undefined })); }}
                    placeholder="e.g., 80" min="1" max="100" step="1"
                    className={`w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none ${formErrors.minAccuracy ? 'border-red-500' : 'border-gray-200 focus:border-red-500'}`} />
                  {formErrors.minAccuracy && <p className="text-xs text-red-600 font-semibold mt-1">{formErrors.minAccuracy}</p>}
                </div>
              </div>
            </div>
            <div className="flex gap-3 px-4 sm:px-6 md:px-8 py-4 border-t border-gray-100 shrink-0">
              <button onClick={() => setShowCreateAssignment(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200">Cancel</button>
              <button onClick={handleCreateAssignment} disabled={creatingAssignment}
                className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 disabled:opacity-60">
                {creatingAssignment ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Student Confirmation */}
      {removeConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setRemoveConfirm(null)}>
          <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 max-w-sm w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">Remove Student?</h2>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to remove <strong>{removeConfirm.name}</strong> from this classroom? They will lose access to all assignments.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setRemoveConfirm(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-sm">Cancel</button>
              <button onClick={() => handleRemoveStudent(removeConfirm.id)}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 text-sm">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Classroom Confirmation */}
      {deleteClassroomConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteClassroomConfirm(false)}>
          <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 max-w-sm w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">Delete Classroom?</h2>
            <p className="text-gray-600 text-sm mb-2">
              Are you sure you want to delete <strong>{classroom.name}</strong>?
            </p>
            <p className="text-red-600 text-xs font-semibold mb-6">
              This will permanently remove all students, assignments, and submissions. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteClassroomConfirm(false)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-sm">Cancel</button>
              <button onClick={async () => {
                await fetch(`${base}/api/classrooms/${classroomId}`, { method: 'DELETE' });
                navigate(-1);
              }}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 text-sm">Delete Forever</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Assignment Confirmation */}
      {deleteAssignmentConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setDeleteAssignmentConfirm(null)}>
          <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 max-w-sm w-full shadow-2xl text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-xl font-black text-gray-900 mb-2">Delete Assignment?</h2>
            <p className="text-gray-600 text-sm mb-2">
              Are you sure you want to delete <strong>{deleteAssignmentConfirm.title}</strong>?
            </p>
            <p className="text-red-600 text-xs font-semibold mb-6">
              All student submissions and progress will be permanently removed.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteAssignmentConfirm(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-sm">Cancel</button>
              <button onClick={() => handleDeleteAssignment(deleteAssignmentConfirm.id)}
                className="flex-1 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 text-sm">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Classroom Modal */}
      {showEditClassroom && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowEditClassroom(false)}>
          <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-black text-gray-900 mb-6">Edit Classroom</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Classroom Name</label>
                <input type="text" value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-red-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Subject</label>
                <input type="text" value={editForm.subject} onChange={e => setEditForm({ ...editForm, subject: e.target.value })}
                  placeholder="e.g., Math" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-red-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Grade Level <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                <input type="text" value={editForm.gradeLevel} onChange={e => setEditForm({ ...editForm, gradeLevel: e.target.value })}
                  placeholder="e.g., 9th Grade" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:border-red-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Class Image <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                {editForm.imageUrl && (
                  <div className="relative mb-2">
                    <img src={editForm.imageUrl} alt="" className="w-full h-32 object-cover rounded-xl border border-gray-200" />
                    <button onClick={() => setEditForm({ ...editForm, imageUrl: '' })}
                      className="absolute top-2 right-2 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center text-xs hover:bg-black/80">×</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input type="text" value={editForm.imageUrl} onChange={e => setEditForm({ ...editForm, imageUrl: e.target.value })}
                    placeholder="Paste image URL..." className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-xl text-xs focus:border-red-500 focus:outline-none" />
                  <label className="px-3 py-2 bg-gray-100 text-gray-700 border-2 border-gray-200 rounded-xl text-xs font-bold cursor-pointer hover:bg-gray-200">
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const reader = new FileReader();
                      reader.onload = async () => {
                        const res = await fetch(`${base}/api/upload-image`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ imageData: reader.result }) });
                        const data = await res.json();
                        if (data.url) setEditForm(prev => ({ ...prev, imageUrl: data.url }));
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }} />
                  </label>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowEditClassroom(false)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 text-sm">Cancel</button>
              <button onClick={async () => {
                await fetch(`${base}/api/classrooms/${classroomId}`, {
                  method: 'PUT', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ name: editForm.name, subject: editForm.subject, gradeLevel: editForm.gradeLevel, imageUrl: editForm.imageUrl })
                });
                setShowEditClassroom(false);
                fetchClassroom();
              }} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 text-sm">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Detail Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedAssignment(null)}>
          <div className="bg-white rounded-3xl p-4 sm:p-6 md:p-8 max-w-lg w-full shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-gray-900 mb-1">{selectedAssignment.title}</h2>
            <p className="text-sm text-gray-500 mb-4">{selectedAssignment.kit_title} &middot; {selectedAssignment.classroom_name}</p>
            <h3 className="font-bold text-gray-900 mb-3 text-sm">Student Progress</h3>
            <div className="space-y-2">
              {(selectedAssignment.submissions || []).map(s => (
                <div key={s.student_id} className={`flex items-center gap-3 p-3 rounded-xl ${s.status === 'completed' ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center ${s.status === 'completed' ? 'bg-green-500' : 'bg-gray-300'}`}>
                    {s.status === 'completed' ? <Check className="w-4 h-4 text-white" /> : <Clock className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1">
                    <span className="font-bold text-sm text-gray-900">{s.name}</span>
                    {s.status === 'completed' && <span className="text-xs text-green-600 ml-2">{s.questions_answered}q &middot; {s.correct_answers > 0 && s.questions_answered > 0 ? Math.round((s.correct_answers / s.questions_answered) * 100) : 0}% &middot; {s.score}pts</span>}
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.status}
                  </span>
                </div>
              ))}
            </div>
            <button onClick={() => setSelectedAssignment(null)} className="w-full mt-4 py-2.5 bg-gray-100 text-gray-700 font-bold rounded-xl text-sm hover:bg-gray-200">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
