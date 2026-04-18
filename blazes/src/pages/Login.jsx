import React, { useState } from 'react';
import { Flame, Mail, Lock, ArrowRight, ArrowLeft } from 'lucide-react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import Popup from '../components/Popup';


export default function Login() {
    const navigate = useNavigate();
    const location = useLocation();
    const [step, setStep] = useState(1); // 1 = email, 2 = password
    const [email, setEmail] = useState('');
    const [emailError, setEmailError] = useState('');
    const [emailNotFound, setEmailNotFound] = useState(false);
    const [checkingEmail, setCheckingEmail] = useState(false);
    const [password, setPassword] = useState('');
    const [popupMessage, setPopupMessage] = useState('');
    const [popupType, setPopupType] = useState('error');
    const [needsVerification, setNeedsVerification] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');
    const [resending, setResending] = useState(false);

    const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());

    const handleEmailSubmit = async (rawEmail) => {
        const trimmed = (rawEmail || '').trim().toLowerCase();
        if (!isValidEmail(trimmed)) {
            setEmailError('Please enter a valid email address');
            setEmailNotFound(false);
            return;
        }
        setEmailError('');
        setEmailNotFound(false);
        setCheckingEmail(true);
        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
            const res = await fetch(`${baseUrl}/api/auth/check-email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: trimmed }),
            });
            const data = await res.json();
            if (!data.exists) {
                setEmailNotFound(true);
                return;
            }
            setEmail(trimmed);
            setStep(2);
        } catch {
            setEmailError("Couldn't reach the server. Try again.");
        } finally {
            setCheckingEmail(false);
        }
    };

    const handleClosePopup = () => {
        setPopupMessage('');
    };

    const handlePasswordSubmit = async () => {
        try {
            const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
            const response = await fetch(`${baseUrl}/api/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: email,
                    password: password,
                }),
            });

            const data = await response.json();
            console.log('Login response:', data);

            if (response.ok) {
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Trigger password manager save
                if (window.PasswordCredential) {
                  try {
                    const cred = new window.PasswordCredential({ id: email, password: password });
                    navigator.credentials.store(cred);
                  } catch (_) {}
                }

                const { redirect, gameCode } = location.state || {};
                if (redirect && gameCode) {
                    navigate(redirect, { state: { gameCode } });
                } else if (data.user.role === 'teacher') {
                    navigate('/home/teacher');
                } else {
                    navigate('/home/student');
                }
            } else {
                if (data.needsVerification) {
                    setNeedsVerification(true);
                    setVerificationEmail(data.email || email);
                    return;
                }
                setPopupMessage(data.message || 'Login failed');
                setPopupType('error');
            }
        } catch (error) {
            console.error('Login error:', error); // Log the full error for debugging
            setPopupMessage(`Cannot connect to server: ${error.message}`);
            setPopupType('error');
        }
    };


    const handleGoogleLogin = () => {
        const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
        window.location.href = `${base}/auth/google`;
    };


    return (
        <>
        {popupMessage && (
          <Popup 
              message={popupMessage} 
              type={popupType}
              onClose={handleClosePopup}
          />
        )}
        <div className="min-h-screen bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo */}
                <div className="flex items-center justify-center gap-3 mb-8">
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <Flame className="w-7 h-7 text-red-600" strokeWidth={2.5} />
                    </div>
                    <h1 className="text-4xl font-black text-white">Blazes</h1>
                </div>

                {/* Form Card */}
                <div className="bg-white rounded-3xl p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <h2 className="text-3xl font-black text-gray-900 mb-2">Welcome Back!</h2>
                        <p className="text-gray-600">
                            {step === 1 ? 'Enter your email to continue' : 'Enter your password'}
                        </p>
                    </div>

                    {location.state?.notice && step === 1 && (
                        <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 text-center mb-5">
                            <p className="text-green-800 font-semibold text-sm">{location.state.notice}</p>
                        </div>
                    )}

                    {step === 1 ? (
                        // Step 1: Email
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handleEmailSubmit(email);
                            }}
                            className="space-y-5"
                        >
                            <div>
                                <label className="block text-sm font-bold text-gray-900 mb-2">
                                    Email Address
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => { setEmail(e.target.value.toLowerCase()); if (emailError) setEmailError(''); if (emailNotFound) setEmailNotFound(false); }}
                                        placeholder="you@example.com"
                                        className={`w-full pl-12 pr-4 py-3 border-2 rounded-xl focus:outline-none transition-colors text-gray-900 ${(emailError || emailNotFound) ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-red-500'}`}
                                        required
                                        autoComplete="email"
                                        aria-invalid={!!emailError || emailNotFound}
                                    />
                                </div>
                                {emailError && <p className="mt-2 text-sm font-semibold text-red-600">{emailError}</p>}
                                {emailNotFound && (
                                    <div className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                                        <p className="text-sm font-semibold text-red-700">
                                            No account found for this email.{' '}
                                            <Link to="/signup" className="underline hover:text-red-900">Sign up instead</Link>
                                        </p>
                                    </div>
                                )}
                            </div>

                            <button
                                type="submit"
                                disabled={!isValidEmail(email) || checkingEmail}
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-red-600"
                            >
                                {checkingEmail ? 'Checking...' : 'Continue'}
                                {!checkingEmail && <ArrowRight className="w-5 h-5" />}
                            </button>

                            {/* Divider */}
                            <div className="relative my-6">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-gray-200"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="px-4 bg-white text-gray-500">or</span>
                                </div>
                            </div>

                            {/* Google Sign In */}
                            <button
                                type="button"
                                onClick={handleGoogleLogin}
                                className="w-full bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-700 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-3"
                            >
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                </svg>
                                Continue with Google
                            </button>

                            <p className="text-center text-gray-600 mt-6">
                                Don't have an account?{' '}
                                <Link to="/signup" className="text-orange-500 font-semibold hover:underline">
                                    Sign up for free
                                </Link>
                            </p>
                        </form>
                    ) : (
                        // Step 2: Password
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                handlePasswordSubmit();   // no args, it uses state
                            }}
                            className="space-y-5"
                        >

                            {needsVerification && (
                                <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 text-center">
                                    <p className="text-amber-800 font-semibold text-sm mb-3">Please verify your email before logging in. Check your inbox.</p>
                                    <button type="button" onClick={async () => {
                                        setResending(true);
                                        try {
                                            const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
                                            await fetch(`${baseUrl}/api/auth/resend-verification`, {
                                                method: 'POST', headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ email: verificationEmail })
                                            });
                                            setPopupMessage('Verification email sent!');
                                            setPopupType('success');
                                        } catch { setPopupMessage('Could not send email'); setPopupType('error'); }
                                        setResending(false);
                                    }}
                                        disabled={resending}
                                        className="text-amber-700 font-bold text-sm underline hover:text-amber-900 disabled:opacity-50">
                                        {resending ? 'Sending...' : 'Resend verification email'}
                                    </button>
                                </div>
                            )}

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-bold text-gray-900">
                                        Password
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="text-sm text-gray-500 hover:text-gray-700"
                                    >
                                        Change email
                                    </button>
                                </div>
                                <div className="text-sm text-gray-600 mb-3">
                                    Logging in as: <span className="font-semibold">{email}</span>
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none transition-colors text-gray-900"
                                        required
                                        autoFocus
                                        autoComplete="current-password"
                                    />
                                </div>
                            </div>

                            <div className="text-right">
                                <a href="/forgot-password" className="text-sm text-red-600 font-semibold hover:underline">
                                    Forgot password?
                                </a>
                            </div>

                            <button
                                type="submit"
                                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg flex items-center justify-center gap-2 text-lg"
                            >
                                Log In
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </form>
                    )}
                </div>

                {/* Back to Home */}
                <button
                    onClick={() => navigate('/')}
                    className="w-full mt-6 text-white font-semibold py-3 flex items-center justify-center gap-2 hover:opacity-80 transition-opacity"
                >
                    <ArrowLeft className="w-5 h-5" />
                    Back to home
                </button>
            </div>
        </div>
        </>
    );
}