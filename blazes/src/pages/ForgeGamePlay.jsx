import { useState, useEffect, useRef, useMemo, useCallback, Suspense } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Canvas, useFrame } from '@react-three/fiber';
import { Environment, ContactShadows, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { Hammer, Clock, Trophy, Flame, Star, BarChart3, X } from 'lucide-react';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';

// Weapon evolves through 5 tiers. Each tier swaps the visible mesh + bumps
// its glow / polish. Stat scaling rewards both correctness AND speed because
// the strike "quality" is computed from the answer's time taken.
const WEAPON_TIERS = [
  { name: 'Slag',     color: '#6b3a1a', emissive: '#ff5a1a', emIntensity: 1.4, glow: 1.2 },
  { name: 'Bar',      color: '#8a4a22', emissive: '#ff7a2a', emIntensity: 1.0, glow: 1.0 },
  { name: 'Blade',    color: '#a85a2a', emissive: '#ffaa3a', emIntensity: 0.7, glow: 0.7 },
  { name: 'Polished', color: '#c08840', emissive: '#ffd060', emIntensity: 0.45, glow: 0.5 },
  { name: 'Legendary',color: '#e8c050', emissive: '#fff0a0', emIntensity: 0.6, glow: 1.4 },
];

export default function ForgeGamePlay({ gameCode: propCode, user: propUser }) {
  const params = useParams();
  const gameCode = propCode || params.gameCode;
  const navigate = useNavigate();
  const [user] = useState(() => {
    try { return propUser || JSON.parse(localStorage.getItem('user') || 'null'); }
    catch { return null; }
  });

  const [game, setGame] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [tier, setTier] = useState(0);     // 0..4
  const [strikes, setStrikes] = useState(0); // total correct answers
  const [misses, setMisses] = useState(0);
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [liveLeaderboard, setLiveLeaderboard] = useState([]);
  const [strikeFx, setStrikeFx] = useState(0); // bumps on each hit to trigger 3D animation
  const startTimeRef = useRef(Date.now());
  const gameStartRef = useRef(null);
  const advanceRef = useRef(null);

  // Load game + questions
  useEffect(() => {
    fetch(`${BASE}/api/games/${gameCode}`).then(r => r.json()).then(d => {
      setGame(d);
      const qs = Array.isArray(d?.questions) ? d.questions : [];
      setQuestions([...qs].sort(() => Math.random() - 0.5));
      if (d?.started_at) {
        const s = d.started_at;
        const iso = s.includes('T') ? s : s.replace(' ', 'T') + (s.endsWith('Z') ? '' : 'Z');
        gameStartRef.current = new Date(iso).getTime();
      }
    }).catch(() => {});
  }, [gameCode]);

  // Server-side answer record (reuses /answer; backend just stores the
  // answer + grants a default point award we override locally via tiers).
  const submitToServer = useCallback(async (q, value, isCorrect, timeTaken) => {
    if (!user?.id || !q?.id) return;
    try {
      await fetch(`${BASE}/api/games/${gameCode}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id, questionId: q.id,
          selectedAnswer: String(value ?? ''),
          isCorrect, timeTaken,
        }),
      });
    } catch (_) {}
  }, [gameCode, user]);

  // Timer
  useEffect(() => {
    if (!game?.settings) return;
    const totalSec = game.settings.timeLimit || 600;
    const id = setInterval(() => {
      if (!gameStartRef.current) { setTimeLeft(totalSec); return; }
      const elapsed = (Date.now() - gameStartRef.current) / 1000;
      const left = Math.max(0, Math.ceil(totalSec - elapsed));
      setTimeLeft(left);
      if (left === 0) {
        navigate(`/game/results/${gameCode}`, { state: { game, user, score, correctCount: strikes, questionsAnswered: strikes + misses, totalQuestions: questions.length } });
      }
    }, 250);
    return () => clearInterval(id);
  }, [game, gameCode, navigate, user, score, strikes, misses, questions.length]);

  // Reset selection on question change
  useEffect(() => {
    setSelected(null);
    setAnswered(false);
    setFeedback(null);
    startTimeRef.current = Date.now();
  }, [tick]);

  // Live leaderboard polling (only while modal is open)
  useEffect(() => {
    if (!showLeaderboard) return;
    const fetchLb = async () => {
      try {
        const r = await fetch(`${BASE}/api/games/${gameCode}`);
        if (!r.ok) return;
        const d = await r.json();
        const sorted = [...(d.participants || [])].sort((a, b) => (b.score || 0) - (a.score || 0));
        setLiveLeaderboard(sorted);
      } catch (_) {}
    };
    fetchLb();
    const id = setInterval(fetchLb, 2000);
    return () => clearInterval(id);
  }, [showLeaderboard, gameCode]);

  const currentQ = questions.length > 0 ? questions[tick % questions.length] : null;

  const handleAnswer = async (value) => {
    if (answered || !currentQ) return;
    setAnswered(true);
    setSelected(value);
    const correctAnswer = currentQ.correctAnswer;
    const at = currentQ.answerType || currentQ.answer_type;
    let isCorrect;
    if (at === 'true_false') {
      const idx = value === 'True' ? 0 : 1;
      isCorrect = Number(correctAnswer) === idx
        || String(correctAnswer).toLowerCase() === String(value).toLowerCase();
    } else {
      // Multiple choice: value is the option letter A/B/C/D
      const upperLetter = String(value).toUpperCase();
      const idx = ['A', 'B', 'C', 'D'].indexOf(upperLetter);
      isCorrect = idx === Number(correctAnswer)
        || String(correctAnswer).toUpperCase() === upperLetter;
    }

    const timeTaken = (Date.now() - startTimeRef.current) / 1000;
    setFeedback({ isCorrect, correct: correctAnswer });

    if (isCorrect) {
      // Speed curve: 50-100 base reward, faster = bigger
      const limit = currentQ.time_limit || 20;
      const ratio = Math.min(1, timeTaken / limit);
      const pts = Math.round(50 + 50 * (1 - ratio));
      const newStrikes = strikes + 1;
      setStrikes(newStrikes);
      setScore(s => s + pts);
      // Tier up every 4 strikes (max tier index 4)
      const nextTier = Math.min(4, Math.floor(newStrikes / 4));
      if (nextTier > tier) setTier(nextTier);
      setStrikeFx(f => f + 1);
    } else {
      setMisses(m => m + 1);
    }

    submitToServer(currentQ, value, isCorrect, timeTaken);

    advanceRef.current = setTimeout(() => setTick(t => t + 1), isCorrect ? 1100 : 1500);
  };

  useEffect(() => () => { if (advanceRef.current) clearTimeout(advanceRef.current); }, []);

  const formatTime = (s) => s == null ? '--:--' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const tierData = WEAPON_TIERS[tier];

  return (
    <div className="h-screen w-screen overflow-hidden text-white relative"
         style={{ background: 'radial-gradient(ellipse at center, #1a0808 0%, #0a0404 60%, #050202 100%)' }}>

      {/* 3D forge scene fills the screen as the backdrop */}
      <div className="absolute inset-0">
        <Canvas
          shadows
          dpr={[1, 1.8]}
          camera={{ position: [0, 1.4, 4.2], fov: 42 }}
          gl={{ antialias: true, alpha: false }}
        >
          <color attach="background" args={['#0a0404']} />
          <fog attach="fog" args={['#0a0404', 6, 14]} />
          <Suspense fallback={null}>
            <ForgeScene tier={tier} tierData={tierData} strikeFx={strikeFx} />
            <Environment preset="warehouse" />
          </Suspense>
          <ContactShadows position={[0, -0.99, 0]} opacity={0.75} scale={8} blur={2.4} far={2} />
          {/* Disable interactive controls in production; useful in dev */}
          {false && <OrbitControls />}
        </Canvas>
      </div>

      {/* Top bar — score, tier, time */}
      <header className="absolute top-0 inset-x-0 p-4 sm:p-6 flex items-center justify-between z-10 pointer-events-none">
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <div className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur border border-red-500/30 flex items-center gap-2 shadow-lg">
            <Hammer className="w-4 h-4 text-orange-400" />
            <div>
              <div className="text-[9px] font-black uppercase tracking-widest text-orange-300/70 leading-none">Tier</div>
              <div className="font-black text-sm leading-none mt-0.5" style={{ color: tierData.emissive }}>
                {tierData.name}
              </div>
            </div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur border border-orange-500/30 flex items-center gap-2 shadow-lg">
            <Star className="w-4 h-4 text-yellow-300" />
            <span className="font-black tabular-nums text-base">{strikes}</span>
            <span className="text-[10px] font-bold text-orange-200/60 uppercase tracking-wider">strikes</span>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 pointer-events-auto">
          <button
            onClick={() => setShowLeaderboard(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur border border-white/15 hover:bg-black/80 transition-colors shadow-lg"
            title="Live leaderboard"
          >
            <BarChart3 className="w-4 h-4 text-red-300" />
            <span className="hidden sm:inline text-xs font-black uppercase tracking-wider">Leaderboard</span>
          </button>
          <div className="px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur border border-yellow-500/30 flex items-center gap-2 shadow-lg">
            <Trophy className="w-4 h-4 text-yellow-300" />
            <span className="font-black tabular-nums">{score}</span>
          </div>
          {timeLeft != null && (
            <div className={`px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur border flex items-center gap-2 shadow-lg ${
              timeLeft < 30 ? 'border-red-500/60 animate-pulse' : 'border-white/15'
            }`}>
              <Clock className="w-4 h-4 text-red-300" />
              <span className="font-black tabular-nums">{formatTime(timeLeft)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Question card overlaid on the bottom half so the 3D forge stays the
          star of the screen. Translucent so the glow underneath bleeds through. */}
      <main className="absolute inset-x-0 bottom-0 z-10 p-4 sm:p-6 pointer-events-none">
        <div className="max-w-3xl mx-auto pointer-events-auto">
          {!currentQ ? (
            <div className="rounded-2xl bg-black/65 backdrop-blur-xl border border-red-500/20 p-8 text-center text-red-200/70 font-semibold">
              Loading questions…
            </div>
          ) : (
            <div className="rounded-2xl border shadow-2xl"
                 style={{
                   background: 'rgba(10, 5, 5, 0.78)',
                   backdropFilter: 'blur(14px)',
                   borderColor: 'rgba(239,68,68,0.25)',
                   boxShadow: '0 20px 60px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
                 }}>
              {/* Question header */}
              <div className="px-5 sm:px-7 pt-5 pb-3 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
                      style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5' }}>
                  <Flame className="w-3 h-3" /> Strike {tick + 1}
                </span>
                {feedback && (
                  <span className={`text-xs font-black uppercase tracking-widest ${feedback.isCorrect ? 'text-emerald-300' : 'text-red-300'}`}>
                    {feedback.isCorrect ? '+ tier progress' : `Answer: ${feedback.correct}`}
                  </span>
                )}
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white text-center px-5 sm:px-7 pb-4 leading-tight whitespace-pre-line">
                {currentQ.text || currentQ.question_text}
              </h2>

              {/* Answer buttons */}
              <div className="px-5 sm:px-7 pb-6">
                <AnswerButtons q={currentQ} answered={answered} selected={selected} feedback={feedback} onPick={handleAnswer} />
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Live leaderboard modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowLeaderboard(false)}>
          <div className="bg-[#100808] rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl border border-red-500/30" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-red-500/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                     style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <BarChart3 className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <div className="text-base font-black">Live Standings</div>
                  <div className="text-xs text-red-200/50">Updates every 2 seconds</div>
                </div>
              </div>
              <button onClick={() => setShowLeaderboard(false)} className="p-2 hover:bg-white/5 rounded-lg">
                <X className="w-5 h-5 text-white/60" />
              </button>
            </div>
            <ul className="flex-1 overflow-y-auto p-3 space-y-1.5">
              {liveLeaderboard.length === 0 ? (
                <li className="text-center py-8 text-white/40 text-sm font-semibold">Waiting for scores…</li>
              ) : (
                liveLeaderboard.slice(0, 10).map((p, i) => {
                  const isMe = p.user_id === user?.id;
                  return (
                    <li key={p.user_id} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border ${
                      isMe ? 'bg-red-500/15 border-red-500/40' : 'bg-white/[0.03] border-white/[0.05]'
                    }`}>
                      <span className="font-black tabular-nums w-6 text-center text-sm" style={{
                        color: i === 0 ? '#fbbf24' : i === 1 ? '#f97316' : i === 2 ? '#fb923c' : 'rgba(255,255,255,0.4)'
                      }}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-black text-sm truncate">{p.player_name || 'Player'}{isMe && <span className="ml-1.5 text-[10px] text-red-300">YOU</span>}</div>
                      </div>
                      <div className="font-black tabular-nums">{p.score || 0}</div>
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// 3D scene — composes the forge stage, anvil, glowing weapon, and hammer.
// All geometry is built from primitives so the bundle doesn't need any
// .glb model files. tier drives both the weapon mesh choice and the glow
// strength; strikeFx is a counter that bumps on every successful answer
// and triggers the hammer-swing + spark animation.
function ForgeScene({ tier, tierData, strikeFx }) {
  return (
    <group>
      {/* Key + rim lighting + forge-fire point light underneath the anvil */}
      <ambientLight intensity={0.25} color={'#3a1a0a'} />
      <directionalLight
        position={[3, 5, 3]}
        intensity={0.85}
        color={'#ffb060'}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <pointLight position={[-1.6, 0.3, 1.0]} intensity={6} color={'#ff5a1a'} distance={4.5} decay={1.4} />
      <pointLight position={[0, 0.2, 0.4]} intensity={tierData.glow * 3} color={tierData.emissive} distance={3} decay={1.6} />

      {/* Stone floor */}
      <mesh receiveShadow position={[0, -1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#1a0a0a" roughness={0.95} metalness={0} />
      </mesh>

      {/* Forge fire pit on the left — bright emissive sphere acts as our hero light */}
      <ForgeFirePit />

      {/* Anvil — boxy iron silhouette built from primitives */}
      <Anvil />

      {/* The forged weapon — glows + bobs + spins on the anvil top */}
      <Weapon tier={tier} tierData={tierData} strikeFx={strikeFx} />

      {/* Hammer — swings on each strike */}
      <Hammer3D strikeFx={strikeFx} />

      {/* Sparks burst on strike */}
      <Sparks strikeFx={strikeFx} />
    </group>
  );
}

function ForgeFirePit() {
  const flameRef = useRef();
  useFrame(({ clock }) => {
    if (!flameRef.current) return;
    const t = clock.getElapsedTime();
    flameRef.current.scale.setScalar(0.85 + Math.sin(t * 5) * 0.12);
  });
  return (
    <group position={[-1.8, -0.55, 0.4]}>
      {/* Stone basin */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.55, 0.7, 0.4, 24]} />
        <meshStandardMaterial color="#1f0e0a" roughness={1} />
      </mesh>
      {/* Burning core — emissive sphere */}
      <mesh ref={flameRef} position={[0, 0.45, 0]}>
        <sphereGeometry args={[0.35, 24, 24]} />
        <meshStandardMaterial
          color={'#ff7028'}
          emissive={'#ff4010'}
          emissiveIntensity={3.5}
          roughness={1}
          metalness={0}
        />
      </mesh>
    </group>
  );
}

function Anvil() {
  return (
    <group position={[0, -0.5, 0]}>
      {/* Base block */}
      <mesh castShadow receiveShadow position={[0, 0, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.7]} />
        <meshStandardMaterial color="#1a1a1d" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Waist taper */}
      <mesh castShadow receiveShadow position={[0, 0.32, 0]}>
        <boxGeometry args={[0.55, 0.18, 0.5]} />
        <meshStandardMaterial color="#2a2a2e" roughness={0.5} metalness={0.7} />
      </mesh>
      {/* Striking top (the face) */}
      <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
        <boxGeometry args={[1.4, 0.18, 0.55]} />
        <meshStandardMaterial color="#3a3a3e" roughness={0.32} metalness={0.85} />
      </mesh>
      {/* Horn — cone sticking out the front */}
      <mesh castShadow position={[0.95, 0.5, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.13, 0.5, 24]} />
        <meshStandardMaterial color="#3a3a3e" roughness={0.3} metalness={0.85} />
      </mesh>
    </group>
  );
}

function Weapon({ tier, tierData, strikeFx }) {
  const grpRef = useRef();
  const glowRef = useRef(1);
  // Each strike bumps an internal glow which decays over time.
  useEffect(() => {
    if (strikeFx > 0) glowRef.current = 2.2;
  }, [strikeFx]);
  useFrame(({ clock }, dt) => {
    if (!grpRef.current) return;
    const t = clock.getElapsedTime();
    grpRef.current.position.y = 0.22 + Math.sin(t * 1.5) * 0.04;
    grpRef.current.rotation.y = t * 0.5;
    glowRef.current = Math.max(1, glowRef.current - dt * 1.6);
  });
  const emissiveIntensity = tierData.emIntensity * glowRef.current;

  // Tier-specific mesh: lump → bar → rough blade → sword → legendary
  const Body = () => {
    if (tier === 0) {
      return (
        <mesh castShadow>
          <icosahedronGeometry args={[0.18, 1]} />
          <meshStandardMaterial color={tierData.color} emissive={tierData.emissive} emissiveIntensity={emissiveIntensity} roughness={0.7} metalness={0.6} />
        </mesh>
      );
    }
    if (tier === 1) {
      return (
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.08, 0.12]} />
          <meshStandardMaterial color={tierData.color} emissive={tierData.emissive} emissiveIntensity={emissiveIntensity} roughness={0.5} metalness={0.7} />
        </mesh>
      );
    }
    if (tier === 2) {
      // Rough blade — flat box with tapered point
      return (
        <group>
          <mesh castShadow position={[0, 0.05, 0]}>
            <boxGeometry args={[0.08, 0.55, 0.02]} />
            <meshStandardMaterial color={tierData.color} emissive={tierData.emissive} emissiveIntensity={emissiveIntensity} roughness={0.35} metalness={0.78} />
          </mesh>
          <mesh castShadow position={[0, -0.27, 0]}>
            <boxGeometry args={[0.16, 0.04, 0.04]} />
            <meshStandardMaterial color="#2a1a0a" roughness={0.7} metalness={0.5} />
          </mesh>
          <mesh castShadow position={[0, -0.4, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.18, 12]} />
            <meshStandardMaterial color="#5a2a18" roughness={0.7} />
          </mesh>
        </group>
      );
    }
    if (tier === 3) {
      // Polished sword
      return (
        <group>
          <mesh castShadow position={[0, 0.1, 0]}>
            <boxGeometry args={[0.07, 0.7, 0.018]} />
            <meshStandardMaterial color={tierData.color} emissive={tierData.emissive} emissiveIntensity={emissiveIntensity} roughness={0.18} metalness={0.92} />
          </mesh>
          <mesh castShadow position={[0, -0.28, 0]}>
            <boxGeometry args={[0.22, 0.04, 0.05]} />
            <meshStandardMaterial color="#3a1a0a" roughness={0.5} metalness={0.6} />
          </mesh>
          <mesh castShadow position={[0, -0.42, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.18, 14]} />
            <meshStandardMaterial color="#6a3018" roughness={0.6} />
          </mesh>
          <mesh castShadow position={[0, -0.54, 0]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshStandardMaterial color={tierData.color} emissive={tierData.emissive} emissiveIntensity={emissiveIntensity * 0.6} roughness={0.2} metalness={0.9} />
          </mesh>
        </group>
      );
    }
    // Tier 4 — legendary, halo + thicker blade
    return (
      <group>
        <mesh castShadow position={[0, 0.12, 0]}>
          <boxGeometry args={[0.09, 0.82, 0.02]} />
          <meshStandardMaterial color={tierData.color} emissive={tierData.emissive} emissiveIntensity={emissiveIntensity * 1.25} roughness={0.1} metalness={0.95} />
        </mesh>
        <mesh castShadow position={[0, -0.3, 0]}>
          <boxGeometry args={[0.28, 0.05, 0.06]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.3} metalness={0.8} />
        </mesh>
        <mesh castShadow position={[0, -0.45, 0]}>
          <cylinderGeometry args={[0.032, 0.032, 0.2, 16]} />
          <meshStandardMaterial color="#8a4a20" roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, -0.58, 0]}>
          <sphereGeometry args={[0.06, 18, 18]} />
          <meshStandardMaterial color={tierData.color} emissive={tierData.emissive} emissiveIntensity={emissiveIntensity * 0.9} roughness={0.15} metalness={0.95} />
        </mesh>
        {/* Halo ring */}
        <mesh position={[0, 0.12, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.35, 0.01, 12, 48]} />
          <meshStandardMaterial color={'#fff0a0'} emissive={'#fff0a0'} emissiveIntensity={2.4} transparent opacity={0.85} />
        </mesh>
      </group>
    );
  };

  return (
    <group ref={grpRef} position={[0, 0.22, 0]}>
      <Body />
    </group>
  );
}

function Hammer3D({ strikeFx }) {
  const grpRef = useRef();
  const swingRef = useRef(0); // 0 = idle, 1 = mid-swing
  useEffect(() => {
    if (strikeFx > 0) swingRef.current = 1;
  }, [strikeFx]);
  useFrame((_, dt) => {
    if (!grpRef.current) return;
    swingRef.current = Math.max(0, swingRef.current - dt * 2.6);
    // Angle eases from -PI/3 (raised) down to 0 (struck) then back.
    const a = (1 - Math.pow(1 - swingRef.current, 2)) * (-Math.PI / 2.2);
    grpRef.current.rotation.z = a;
  });
  return (
    <group position={[0.7, 0.65, 0]}>
      <group ref={grpRef}>
        {/* Handle */}
        <mesh castShadow position={[0, -0.35, 0]}>
          <cylinderGeometry args={[0.04, 0.045, 0.7, 16]} />
          <meshStandardMaterial color="#5a2a14" roughness={0.7} />
        </mesh>
        {/* Head — chunky steel block */}
        <mesh castShadow position={[0, 0, 0]}>
          <boxGeometry args={[0.34, 0.18, 0.18]} />
          <meshStandardMaterial color="#2a2a2e" roughness={0.3} metalness={0.85} />
        </mesh>
      </group>
    </group>
  );
}

function Sparks({ strikeFx }) {
  // Burst position scattered + each particle has its own velocity / lifetime.
  const groupRef = useRef();
  const particles = useMemo(() => {
    return Array.from({ length: 22 }).map((_, i) => ({
      i,
      v: [Math.cos((i / 22) * Math.PI * 2) * (0.6 + Math.random() * 0.4),
          1.2 + Math.random() * 1.4,
          Math.sin((i / 22) * Math.PI * 2) * (0.6 + Math.random() * 0.4)],
    }));
  }, []);
  const lifeRef = useRef(0);
  useEffect(() => {
    if (strikeFx > 0) lifeRef.current = 1;
  }, [strikeFx]);
  useFrame((_, dt) => {
    if (!groupRef.current) return;
    lifeRef.current = Math.max(0, lifeRef.current - dt * 1.8);
    const t = 1 - lifeRef.current;
    groupRef.current.children.forEach((mesh, idx) => {
      const p = particles[idx];
      const yArc = p.v[1] * t - 1.4 * t * t;
      mesh.position.set(p.v[0] * t, yArc, p.v[2] * t);
      const s = lifeRef.current;
      mesh.scale.setScalar(0.06 * s);
      if (mesh.material) {
        mesh.material.emissiveIntensity = 5 * s;
        mesh.material.opacity = s;
        mesh.material.transparent = true;
      }
    });
  });
  return (
    <group ref={groupRef} position={[0, 0.22, 0]}>
      {particles.map((p) => (
        <mesh key={p.i}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshStandardMaterial color={'#ffe080'} emissive={'#ffaa30'} emissiveIntensity={5} transparent opacity={0} />
        </mesh>
      ))}
    </group>
  );
}

// Answer buttons — re-uses the kit's answerType to render T/F or MC, with
// a quick highlight on correct/wrong. The visual feedback is intentionally
// understated so the 3D forge stays the focus when an answer lands.
function AnswerButtons({ q, answered, selected, feedback, onPick }) {
  const at = q.answerType || q.answer_type;
  if (at === 'true_false') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {['True', 'False'].map((label, idx) => {
          const ca = q.correctAnswer;
          const correct = Number(ca) === idx || String(ca).toLowerCase() === label.toLowerCase();
          const isSel = selected === label;
          const cls = answered
            ? correct ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
            : isSel ? 'border-red-400 bg-red-500/20 text-red-200'
            : 'border-white/10 bg-white/[0.02] text-white/40'
            : 'border-red-500/30 bg-white/[0.03] hover:bg-red-500/15 hover:border-red-500/60 text-white';
          return (
            <button key={label} disabled={answered} onClick={() => onPick(label)}
                    className={`py-5 rounded-xl font-black text-xl border-2 transition-colors ${cls}`}>
              {label}
            </button>
          );
        })}
      </div>
    );
  }
  // Default to multiple choice with letter labels
  const opts = q.options || [];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {opts.map((opt, idx) => {
        const letter = ['A', 'B', 'C', 'D'][idx];
        const correctIdx = Number(q.correctAnswer);
        const correct = idx === correctIdx
          || String(q.correctAnswer).toUpperCase() === letter;
        const isSel = selected === letter;
        const cls = answered
          ? correct ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
          : isSel ? 'border-red-400 bg-red-500/20 text-red-200'
          : 'border-white/10 bg-white/[0.02] text-white/40'
          : 'border-red-500/30 bg-white/[0.03] hover:bg-red-500/15 hover:border-red-500/60 text-white';
        return (
          <button key={letter} disabled={answered} onClick={() => onPick(letter)}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-left border-2 font-bold transition-colors ${cls}`}>
            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black border border-current opacity-70">{letter}</span>
            <span className="flex-1 text-sm sm:text-base">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}
