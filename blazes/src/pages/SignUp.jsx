import React, { useState, useEffect } from 'react';
import { Flame, Bell, Trophy, TrendingUp, Star, Zap, Target, Award, Clock, Users, Play, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Popup from '../components/Popup';
import StyledSelect from '../components/StyledSelect';
import SubjectPicker from '../components/SubjectPicker';

const SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'History',
  'Geography',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Languages',
  'Art',
  'Music',
  'Physical Education'
];

export default function SignUp() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState('student');
  const [studentForm, setStudentForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [teacherForm, setTeacherForm] = useState({
    firstName: '',
    lastName: '',
    title: 'Mr',
    email: '',
    password: '',
    confirmPassword: '',
    subject: '',
    customSubject: '',
    above18: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [popupMessage, setPopupMessage] = useState('');
  const [popupType, setPopupType] = useState('error');
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkedEmail, setCheckedEmail] = useState('');

  const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((value || '').trim());

  const checkEmailAvailability = async (rawEmail) => {
    const trimmed = (rawEmail || '').trim().toLowerCase();
    if (!isValidEmail(trimmed)) { setEmailTaken(false); setCheckedEmail(''); return; }
    if (trimmed === checkedEmail) return;
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const res = await fetch(`${base}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      setEmailTaken(!!data.exists);
      setCheckedEmail(trimmed);
    } catch {
      // network error — silently skip the pre-check; the submit will still catch duplicates
    }
  };

  useEffect(() => {
    // Check if user is already authenticated on page load (from a previous session)
    // Don't redirect - we want users to be able to visit sign-up page freely
    // The redirect will happen after successful signup submission
  }, []);

  const handleClosePopup = () => {
    setPopupMessage('');
  };

  const handleStudentChange = (e) => {
    const { name, value } = e.target;
    setStudentForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleTeacherChange = (e) => {
    const { name, value, type, checked } = e.target;
    setTeacherForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateStudentForm = () => {
    if (!studentForm.name || !studentForm.email || !studentForm.password || !studentForm.confirmPassword) {
      return { valid: false, message: 'All fields are required' };
    }
    if (studentForm.password !== studentForm.confirmPassword) {
      return { valid: false, message: 'Passwords do not match' };
    }
    if (studentForm.password.length < 6) {
      return { valid: false, message: 'Password must be at least 6 characters' };
    }
    return { valid: true };
  };

  const validateTeacherForm = () => {
    if (!teacherForm.firstName || !teacherForm.lastName || !teacherForm.email || !teacherForm.password || !teacherForm.confirmPassword) {
      return { valid: false, message: 'All fields are required' };
    }
    if (!teacherForm.subject && !teacherForm.customSubject) {
      return { valid: false, message: 'Please select or enter a subject' };
    }
    if (!teacherForm.above18) {
      return { valid: false, message: 'You must confirm that you are 18 years or older' };
    }
    if (teacherForm.password !== teacherForm.confirmPassword) {
      return { valid: false, message: 'Passwords do not match' };
    }
    if (teacherForm.password.length < 6) {
      return { valid: false, message: 'Password must be at least 6 characters' };
    }
    return { valid: true };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Validate form based on role
    let validation;
    if (role === 'student') {
      validation = validateStudentForm();
      if (!validation.valid) {
        setPopupMessage(validation.message);
        setPopupType('error');
        setLoading(false);
        return;
      }
    } else {
      validation = validateTeacherForm();
      if (!validation.valid) {
        setPopupMessage(validation.message);
        setPopupType('error');
        setLoading(false);
        return;
      }
    }

    // Final email-availability check (in case the user didn't blur out of the field).
    const emailToCheck = (role === 'student' ? studentForm.email : teacherForm.email).trim().toLowerCase();
    if (!isValidEmail(emailToCheck)) {
      setPopupMessage('Please enter a valid email address');
      setPopupType('error');
      setLoading(false);
      return;
    }
    try {
      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const res = await fetch(`${base}/api/auth/check-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToCheck }),
      });
      const data = await res.json();
      if (data.exists) {
        setEmailTaken(true);
        setCheckedEmail(emailToCheck);
        setLoading(false);
        return;
      }
    } catch { /* ignore; server will also reject duplicates */ }

    try {
      const payload = role === 'student' ? {
        name: studentForm.name,
        email: studentForm.email,
        password: studentForm.password,
        role: 'student'
      } : {
        firstName: teacherForm.firstName,
        lastName: teacherForm.lastName,
        title: teacherForm.title,
        name: `${teacherForm.title} ${teacherForm.firstName} ${teacherForm.lastName}`,
        email: teacherForm.email,
        password: teacherForm.password,
        role: 'teacher',
        subject: teacherForm.subject || teacherForm.customSubject
      };

      const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
      const response = await fetch(`${base}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        setPopupMessage(data.message || 'Sign up failed');
        setPopupType('error');
        setLoading(false);
        return;
      }

      // If email verification is needed, redirect to login with notice
      if (data.needsVerification) {
        // Trigger password manager save before redirecting
        if (window.PasswordCredential) {
          try {
            const cred = new window.PasswordCredential({
              id: role === 'student' ? studentForm.email : teacherForm.email,
              password: role === 'student' ? studentForm.password : teacherForm.password,
              name: role === 'student' ? studentForm.name : `${teacherForm.firstName} ${teacherForm.lastName}`
            });
            navigator.credentials.store(cred);
          } catch (_) {}
        }
        navigate('/login', { state: { notice: 'Account created! Check your email to verify before logging in.' } });
        return;
      }

      // Store auth data
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Trigger password manager save
      if (window.PasswordCredential) {
        try {
          const cred = new window.PasswordCredential({
            id: role === 'student' ? studentForm.email : teacherForm.email,
            password: role === 'student' ? studentForm.password : teacherForm.password,
            name: role === 'student' ? studentForm.name : `${teacherForm.firstName} ${teacherForm.lastName}`
          });
          navigator.credentials.store(cred);
        } catch (_) {}
      }

      // Redirect based on role (or back to game join if coming from there)
      const { redirect, gameCode } = location.state || {};
      if (redirect && gameCode) {
        navigate(redirect, { state: { gameCode } });
      } else if (data.user.role === 'teacher') {
        navigate('/home/teacher');
      } else {
        navigate('/home/student');
      }
    } catch (err) {
      setPopupMessage('An error occurred. Please try again.');
      setPopupType('error');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center p-4">
      {popupMessage && (
        <Popup 
          message={popupMessage} 
          type={popupType}
          onClose={handleClosePopup}
        />
      )}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
            <Flame className="w-6 h-6 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-2xl font-black text-gray-900">Blazes</span>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black text-gray-900 mb-2">Create Account</h1>
          <p className="text-gray-600">Join thousands of students learning smarter</p>
        </div>

        {/* Role Selection */}
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">I am a:</label>
          <div className="flex gap-3">
            <label className="flex-1 relative">
              <input
                type="radio"
                name="role"
                value="student"
                checked={role === 'student'}
                onChange={(e) => {
                  setRole(e.target.value);
                }}
                className="sr-only"
              />
              <div className={`p-3 rounded-lg border-2 text-center font-bold cursor-pointer transition-all ${role === 'student' ? 'border-red-600 bg-red-50 text-red-600' : 'border-gray-300 text-gray-700'}`}>
                Student
              </div>
            </label>
            <label className="flex-1 relative">
              <input
                type="radio"
                name="role"
                value="teacher"
                checked={role === 'teacher'}
                onChange={(e) => {
                  setRole(e.target.value);
                }}
                className="sr-only"
              />
              <div className={`p-3 rounded-lg border-2 text-center font-bold cursor-pointer transition-all ${role === 'teacher' ? 'border-orange-600 bg-orange-50 text-orange-600' : 'border-gray-300 text-gray-700'}`}>
                Teacher
              </div>
            </label>
          </div>
        </div>

        {/* Google Sign Up (students only) */}
        {role === 'student' && (
          <>
            <button
              type="button"
              onClick={() => {
                const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                window.location.href = `${base}/auth/google`;
              }}
              className="w-full mt-4 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-3"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            <div className="relative my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500">or sign up with email</span>
              </div>
            </div>
          </>
        )}

        {/* Student Form */}
        {role === 'student' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
              <input
                type="text"
                name="name"
                value={studentForm.name}
                onChange={handleStudentChange}
                placeholder="John Doe"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none transition-colors"
                autoComplete="name"
              />
            </div>

            {/* Email Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={studentForm.email}
                onChange={(e) => { handleStudentChange(e); if (emailTaken) setEmailTaken(false); }}
                onBlur={() => checkEmailAvailability(studentForm.email)}
                placeholder="student@example.com"
                className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none transition-colors ${emailTaken ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-red-500'}`}
                autoComplete="email"
                aria-invalid={emailTaken}
              />
              {emailTaken && (
                <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-sm font-semibold text-red-700">
                    An account already exists for this email.{' '}
                    <Link to="/login" className="underline hover:text-red-900">Log in instead</Link>
                  </p>
                </div>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={studentForm.password}
                onChange={handleStudentChange}
                placeholder="Enter password"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none transition-colors"
                autoComplete="new-password"
              />
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={studentForm.confirmPassword}
                onChange={handleStudentChange}
                placeholder="Confirm password"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-red-500 focus:outline-none transition-colors"
                autoComplete="new-password"
              />
            </div>

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={loading || emailTaken}
              className="w-full bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
        )}

        {/* Teacher Form */}
        {role === 'teacher' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title and Name Fields */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Title</label>
                <StyledSelect
                  value={teacherForm.title}
                  onChange={v => handleTeacherChange({ target: { name: 'title', value: v } })}
                  options={['Mr', 'Ms', 'Mrs', 'Dr']}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">First Name</label>
                <input
                  type="text"
                  name="firstName"
                  value={teacherForm.firstName}
                  onChange={handleTeacherChange}
                  placeholder="John"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none transition-colors"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Last Name</label>
                <input
                  type="text"
                  name="lastName"
                  value={teacherForm.lastName}
                  onChange={handleTeacherChange}
                  placeholder="Doe"
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none transition-colors"
                  autoComplete="family-name"
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={teacherForm.email}
                onChange={(e) => { handleTeacherChange(e); if (emailTaken) setEmailTaken(false); }}
                onBlur={() => checkEmailAvailability(teacherForm.email)}
                placeholder="teacher@example.com"
                className={`w-full px-4 py-2 border-2 rounded-lg focus:outline-none transition-colors ${emailTaken ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-orange-500'}`}
                autoComplete="email"
                aria-invalid={emailTaken}
              />
              {emailTaken && (
                <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  <p className="text-sm font-semibold text-red-700">
                    An account already exists for this email.{' '}
                    <Link to="/login" className="underline hover:text-red-900">Log in instead</Link>
                  </p>
                </div>
              )}
            </div>

            {/* Subject Selection */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Subject You Teach</label>
              <SubjectPicker
                value={teacherForm.subject || teacherForm.customSubject}
                onChange={v => {
                  handleTeacherChange({ target: { name: 'subject', value: v } });
                  handleTeacherChange({ target: { name: 'customSubject', value: '' } });
                }}
              />
              <p className="text-xs text-gray-500 mt-2 hidden">Or enter a custom subject below:</p>
              <input
                type="hidden"
                name="customSubject"
                value={teacherForm.customSubject}
                onChange={handleTeacherChange}
                placeholder="Enter custom subject"
                disabled={teacherForm.subject !== ''}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none transition-colors mt-2 disabled:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-500"
              />
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={teacherForm.password}
                onChange={handleTeacherChange}
                placeholder="Enter password"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none transition-colors"
                autoComplete="new-password"
              />
            </div>

            {/* Confirm Password Input */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Confirm Password</label>
              <input
                type="password"
                name="confirmPassword"
                value={teacherForm.confirmPassword}
                onChange={handleTeacherChange}
                placeholder="Confirm password"
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none transition-colors"
                autoComplete="new-password"
              />
            </div>

            {/* Age Confirmation */}
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                name="above18"
                checked={teacherForm.above18}
                onChange={handleTeacherChange}
                className="mt-1 w-4 h-4 rounded border-2 border-gray-300 focus:outline-none"
              />
              <label className="text-sm text-gray-700">
                I confirm that I am <span className="font-bold">18 years or older</span>
              </label>
            </div>

            {/* Sign Up Button */}
            <button
              type="submit"
              disabled={loading || emailTaken}
              className="w-full bg-orange-600 text-white py-3 rounded-lg font-bold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-6"
            >
              {loading ? 'Creating Account...' : 'Sign Up'}
            </button>
          </form>
        )}

        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-red-600 font-bold hover:underline">
              Log In
            </Link>
          </p>
        </div>

        {/* Back to Landing */}
        <div className="mt-4 text-center">
          <Link to="/" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
