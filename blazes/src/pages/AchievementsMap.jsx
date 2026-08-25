import { useState, useEffect } from 'react';
import { Lock, Trophy, Star, Zap, Target, Calendar, TrendingUp, BookOpen, Clock, BarChart3, Award, Brain, Flame, Heart, Swords, Mountain, Crown, Ghost, Shirt, Users, Gamepad2 } from 'lucide-react';

const CATEGORIES = [
    {
        id: 'getting_started', label: 'Getting Started', color: '#f97316',
        achievements: [
            { id: 'first_steps', bb: 20, name: 'First Steps', desc: 'Answer your first question', icon: Star },
            { id: 'getting_the_hang', bb: 30, name: 'Getting the Hang of It', desc: 'Answer 10 questions', icon: Zap },
            { id: 'welcome_aboard', bb: 20, name: 'Welcome Aboard', desc: 'Join a multiplayer game (5+)', icon: Users },
            { id: 'mode_hopper', bb: 50, name: 'Mode Hopper', desc: 'Play every game mode', icon: Gamepad2 },
            { id: 'dressed_up', bb: 30, name: 'Dressed Up', desc: 'Buy your first skin', icon: Shirt },
            { id: 'collector', bb: 60, name: 'Collector', desc: 'Own 10 skins', icon: Shirt },
            { id: 'wardrobe', bb: 100, name: 'Wardrobe', desc: 'Own 25 skins', icon: Shirt },
        ]
    },
    {
        id: 'milestones', label: 'Answer Milestones', color: '#f97316',
        achievements: [
            { id: 'practice_progress', bb: 40, name: 'Practice Makes Progress', desc: 'Answer 50 questions', icon: TrendingUp },
            { id: 'century_club', bb: 60, name: 'Century Club', desc: 'Answer 100 questions', icon: Trophy },
            { id: 'club_250', bb: 40, name: '250 Club', desc: '250 correct answers', icon: Zap },
            { id: 'club_500', bb: 60, name: '500 Club', desc: '500 correct answers', icon: Zap },
            { id: 'club_1000', bb: 100, name: 'Thousand', desc: '1,000 correct answers', icon: Trophy },
            { id: 'club_5000', bb: 150, name: '5K', desc: '5,000 correct answers', icon: Trophy },
            { id: 'club_10000', bb: 300, name: '10K', desc: '10,000 correct answers', icon: Crown },
            { id: 'xp_collector', bb: 50, name: 'XP Collector', desc: 'Earn 1,000 total points', icon: BarChart3 },
        ]
    },
    {
        id: 'streaks', label: 'Streaks', color: '#ef4444',
        achievements: [
            { id: 'warm_up', bb: 10, name: 'Warm Up', desc: '5 correct in a row', icon: Flame },
            { id: 'perfect_session', bb: 100, name: 'Perfect Session', desc: '10 correct in a row', icon: Star },
            { id: 'on_fire', bb: 40, name: 'Twenty in a Row', desc: '20 correct in a row', icon: Flame },
            { id: 'unstoppable', bb: 80, name: 'Unstoppable', desc: '30 correct in a row', icon: Flame },
            { id: 'inhuman', bb: 150, name: 'Inhuman', desc: '50 correct in a row', icon: Crown },
        ]
    },
    {
        id: 'accuracy', label: 'Accuracy', color: '#3b82f6',
        achievements: [
            { id: 'accuracy_apprentice', bb: 40, name: 'Accuracy Apprentice', desc: '60% overall accuracy', icon: Target },
            { id: 'sharpshooter', bb: 80, name: 'Sharpshooter', desc: '80% overall accuracy', icon: Target },
            { id: 'sharp', bb: 20, name: 'Sharp', desc: '90%+ accuracy (10+ q)', icon: Target },
            { id: 'sniper', bb: 40, name: 'Sniper', desc: '100% accuracy (10+ q)', icon: Target },
            { id: 'consistent', bb: 60, name: 'Consistent', desc: '3 games in a row 90%+', icon: TrendingUp },
            { id: 'never_wrong', bb: 100, name: 'Never Wrong', desc: '5 games with 100%', icon: Star },
            { id: 'subject_specialist', bb: 60, name: 'Subject Specialist', desc: '80% in a single subject', icon: BookOpen },
            { id: 'steady_climber', bb: 60, name: 'Steady Climber', desc: 'Improve accuracy 10pp vs last week', icon: TrendingUp },
        ]
    },
    {
        id: 'wins', label: 'Wins', color: '#eab308',
        achievements: [
            { id: 'first_win', bb: 30, name: 'First Win', desc: 'Win a multiplayer game', icon: Trophy },
            { id: 'triple_crown', bb: 50, name: 'Triple Crown', desc: 'Win 3 multiplayer games', icon: Trophy },
            { id: 'champion', bb: 80, name: 'Champion', desc: 'Win 10 multiplayer games', icon: Crown },
            { id: 'dominant', bb: 120, name: 'Dominant', desc: 'Win 25 multiplayer games', icon: Crown },
            { id: 'legend', bb: 200, name: 'Legend', desc: 'Win 50 multiplayer games', icon: Crown },
        ]
    },
    {
        id: 'survival', label: 'Survival', color: '#ef4444',
        achievements: [
            { id: 'survivor', bb: 30, name: 'Survivor', desc: 'Win a Survival game', icon: Heart },
            { id: 'clutch', bb: 50, name: 'Clutch', desc: 'Win with 1 life left', icon: Heart },
            { id: 'untouchable', bb: 80, name: 'Untouchable', desc: 'Win without losing a life', icon: Star },
            { id: 'sudden_death_victor', bb: 60, name: 'Sudden Death Victor', desc: 'Win a sudden death', icon: Zap },
            { id: 'tiebreaker_champion', bb: 80, name: 'Tiebreaker Champion', desc: 'Win a tiebreaker', icon: Trophy },
            { id: 'endurance', bb: 40, name: 'Endurance', desc: 'Survive 15+ rounds', icon: Clock },
            { id: 'iron_will', bb: 70, name: 'Iron Will', desc: 'Survive 25+ rounds', icon: Award },
        ]
    },
    {
        id: 'inferno', label: 'Inferno Tower', color: '#ea580c',
        achievements: [
            { id: 'floor_10', bb: 10, name: 'Floor 10', desc: 'Reach floor 10', icon: Flame },
            { id: 'floor_25', bb: 20, name: 'Floor 25', desc: 'Reach floor 25', icon: Flame },
            { id: 'floor_50', bb: 40, name: 'Floor 50', desc: 'Reach floor 50', icon: Flame },
            { id: 'floor_100', bb: 80, name: 'Floor 100', desc: 'Reach floor 100', icon: Flame },
            { id: 'skyscraper', bb: 150, name: 'Skyscraper', desc: 'Reach floor 200', icon: Mountain },
            { id: 'tower_master', bb: 30, name: 'Tower Master', desc: 'Win Inferno Tower', icon: Trophy },
            { id: 'ghost_hunter', bb: 20, name: 'Ghost Hunter', desc: 'Send 5 fireballs', icon: Ghost },
            { id: 'phantom', bb: 50, name: 'Phantom', desc: 'Send 20 fireballs', icon: Ghost },
            { id: 'fire_walker', bb: 40, name: 'Fire Walker', desc: 'Answer with fire 1 floor away', icon: Flame },
        ]
    },
    {
        id: 'clash', label: 'Elemental Clash', color: '#a855f7',
        achievements: [
            { id: 'team_player', bb: 30, name: 'Team Player', desc: 'Win Elemental Clash', icon: Swords },
            { id: 'artillery', bb: 20, name: 'Artillery', desc: '5 attacks in one game', icon: Swords },
            { id: 'bombardment', bb: 50, name: 'Bombardment', desc: '10 attacks in one game', icon: Swords },
            { id: 'full_arsenal', bb: 40, name: 'Full Arsenal', desc: 'Use all 4 attack types', icon: Star },
            { id: 'energy_hoarder', bb: 30, name: 'Energy Hoarder', desc: 'Have 20+ energy at once', icon: Zap },
            { id: 'clash_mvp', bb: 60, name: 'Clash MVP', desc: 'Top scorer on winning team', icon: Crown },
        ]
    },
    {
        id: 'wager', label: 'Risk & Reward', color: '#d97706',
        achievements: [
            { id: 'tier_2', bb: 10, name: 'Tier 2', desc: 'Reach Tier 2', icon: TrendingUp },
            { id: 'tier_3', bb: 30, name: 'Tier 3', desc: 'Reach Tier 3', icon: TrendingUp },
            { id: 'tier_4', bb: 100, name: 'Tier 4', desc: 'Reach Tier 4', icon: Crown },
            { id: 'high_roller', bb: 20, name: 'High Roller', desc: 'Score 500+', icon: Flame },
            { id: 'jackpot', bb: 50, name: 'Jackpot', desc: 'Score 1,000+', icon: Flame },
            { id: 'fortune', bb: 100, name: 'Fortune', desc: 'Score 2,500+', icon: Star },
            { id: 'all_in', bb: 80, name: 'All In', desc: 'Pick Fire and get it right', icon: Flame },
            { id: 'burned', bb: 10, name: 'Burned', desc: 'Pick Fire and get it wrong', icon: Flame },
        ]
    },
    {
        id: 'sessions', label: 'Sessions', color: '#8b5cf6',
        achievements: [
            { id: 'lightning_brain', bb: 30, name: 'Lightning Brain', desc: 'Correct in under 3 seconds', icon: Zap },
            { id: 'quick_thinker', bb: 20, name: 'Quick Thinker', desc: 'Correct in under 2 seconds', icon: Zap },
            { id: 'lightning_fast', bb: 50, name: 'Lightning', desc: 'Correct in under 1 second', icon: Zap },
            { id: 'focused_mind', bb: 40, name: 'Focused Mind', desc: '15-question session', icon: Brain },
            { id: 'marathon_session', bb: 70, name: 'Marathon Session', desc: '40 questions in one session', icon: Clock },
            { id: 'comeback_learner', bb: 50, name: 'Comeback Learner', desc: 'Miss 3, then get next 5 right', icon: TrendingUp },
        ]
    },
    {
        id: 'consistency', label: 'Consistency', color: '#22c55e',
        achievements: [
            { id: 'daily_grinder', bb: 40, name: 'Daily Grinder', desc: 'Play 3 days in a row', icon: Calendar },
            { id: 'weekly_warrior', bb: 70, name: 'Weekly Warrior', desc: 'Play 7 days in a row', icon: Award },
            { id: 'two_weeks', bb: 80, name: 'Two Weeks', desc: '14-day play streak', icon: Calendar },
            { id: 'one_month', bb: 150, name: 'One Month', desc: '30-day play streak', icon: Calendar },
            { id: 'semester', bb: 300, name: 'Semester', desc: '90-day play streak', icon: Award },
        ]
    },
    {
        id: 'games', label: 'Games Played', color: '#6366f1',
        achievements: [
            { id: 'teachers_favorite', bb: 80, name: "Teacher's Favorite", desc: 'Complete 5 games', icon: Star },
            { id: 'regular', bb: 20, name: 'Regular', desc: 'Play 10 games', icon: Gamepad2 },
            { id: 'dedicated', bb: 40, name: 'Dedicated', desc: 'Play 25 games', icon: Gamepad2 },
            { id: 'veteran', bb: 60, name: 'Veteran', desc: 'Play 50 games', icon: Gamepad2 },
            { id: 'addict', bb: 100, name: 'Addict', desc: 'Play 100 games', icon: Gamepad2 },
            { id: 'no_life', bb: 200, name: 'No Life', desc: 'Play 250 games', icon: Crown },
        ]
    },
    {
        id: 'economy', label: 'BlazesBucks', color: '#10b981',
        achievements: [
            { id: 'first_hundred', bb: 10, name: 'First Hundred', desc: 'Earn 100 BB total', icon: BarChart3 },
            { id: 'thousand_club', bb: 30, name: 'Thousand Club', desc: 'Earn 1,000 BB total', icon: BarChart3 },
            { id: 'five_grand', bb: 60, name: 'Five Grand', desc: 'Earn 5,000 BB total', icon: Trophy },
            { id: 'baller', bb: 100, name: 'Baller', desc: 'Earn 10,000 BB total', icon: Crown },
            { id: 'rich', bb: 200, name: 'Rich', desc: 'Earn 50,000 BB total', icon: Crown },
        ]
    },
    {
        id: 'exploration', label: 'Exploration', color: '#ec4899',
        achievements: [
            { id: 'subject_explorer', bb: 30, name: 'Subject Explorer', desc: '3 different subjects', icon: BookOpen },
            { id: 'error_analyst', bb: 40, name: 'Error Analyst', desc: 'Review missed questions 20x', icon: BarChart3 },
        ]
    },
    {
        id: 'levels', label: 'Season Levels', color: '#dc2626',
        achievements: [
            { id: 'level_5', bb: 30, name: 'Getting Started', desc: 'Reach Level 5', icon: Flame },
            { id: 'level_10', bb: 50, name: 'Bronze Player', desc: 'Reach Level 10', icon: Flame },
            { id: 'level_15', bb: 60, name: 'Warming Up', desc: 'Reach Level 15', icon: Flame },
            { id: 'level_20', bb: 70, name: 'Dedicated Learner', desc: 'Reach Level 20', icon: Star },
            { id: 'level_25', bb: 80, name: 'Silver Player', desc: 'Reach Level 25', icon: Star },
            { id: 'level_30', bb: 100, name: 'Committed', desc: 'Reach Level 30', icon: Trophy },
            { id: 'level_40', bb: 120, name: 'Powerhouse', desc: 'Reach Level 40', icon: Trophy },
            { id: 'level_50', bb: 150, name: 'Gold Player', desc: 'Reach Level 50', icon: Crown },
            { id: 'level_60', bb: 200, name: 'Elite', desc: 'Reach Level 60', icon: Crown },
            { id: 'level_75', bb: 300, name: 'Diamond Player', desc: 'Reach Level 75', icon: Crown },
            { id: 'level_85', bb: 400, name: 'Mythic', desc: 'Reach Level 85', icon: Crown },
            { id: 'level_100', bb: 1000, name: 'Godlike', desc: 'Reach Level 100', icon: Crown },
        ]
    },
    {
        id: 'master', label: 'Master', color: '#f59e0b',
        achievements: [
            { id: 'master_learner', bb: 150, name: 'Master Learner', desc: 'Unlock 10 achievements', icon: Trophy },
            { id: 'half_way', bb: 100, name: 'Half Way', desc: 'Unlock 25 achievements', icon: Award },
            { id: 'completionist', bb: 200, name: 'Completionist', desc: 'Unlock 50 achievements', icon: Crown },
            { id: 'blazes_master', bb: 500, name: 'Blazes Master', desc: 'Unlock 75 achievements', icon: Flame },
        ]
    },
];

const ALL_ACHIEVEMENTS = CATEGORIES.flatMap(c => c.achievements);

function AchNode({ ach, isUnlocked, color, onHover, onLeave }) {
    const Icon = ach.icon;
    return (
        <div className="flex flex-col items-center"
            onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                onHover(ach, isUnlocked, rect);
            }}
            onMouseLeave={onLeave}
        >
            <div className={`relative w-14 h-14 rounded-2xl flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-110
                ${isUnlocked
                    ? 'bg-white border-2 border-green-400 shadow-md hover:shadow-lg'
                    : 'bg-gray-100 border-2 border-gray-200 hover:border-gray-300'
                }
            `}>
                {isUnlocked
                    ? <Icon className="w-6 h-6" style={{ color }} />
                    : <Lock className="w-5 h-5 text-gray-300" />
                }
                {isUnlocked && (
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-[8px] font-black">✓</span>
                    </div>
                )}
            </div>
            <span className={`text-[10px] font-bold mt-1.5 text-center leading-tight max-w-[70px] ${isUnlocked ? 'text-gray-700' : 'text-gray-400'}`}>
                {ach.name}
            </span>
        </div>
    );
}

export default function AchievementsMap({ userId }) {
    const [unlocked, setUnlocked] = useState(new Set());
    const [toast, setToast] = useState(null);
    const [hover, setHover] = useState(null); // { ach, isUnlocked, x, y }

    useEffect(() => {
        if (!userId) return;
        const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
        const load = async () => {
            const r = await fetch(`${base}/api/achievements/${userId}`);
            const d = await r.json();
            setUnlocked(new Set((d.unlocked || []).map(a => a.achievement_id)));
        };
        const check = async () => {
            const r = await fetch(`${base}/api/achievements/check/${userId}`, { method: 'POST' });
            const d = await r.json();
            if (d.newlyUnlocked?.length) {
                setUnlocked(prev => {
                    const next = new Set(prev);
                    d.newlyUnlocked.forEach(a => next.add(a.id));
                    return next;
                });
                d.newlyUnlocked.forEach((a, i) => {
                    setTimeout(() => setToast(a), i * 3500);
                });
            }
        };
        load().then(check);
    }, [userId]);

    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3200);
        return () => clearTimeout(t);
    }, [toast]);

    const totalUnlocked = unlocked.size;
    const totalAchievements = ALL_ACHIEVEMENTS.length;
    const totalBBEarned = ALL_ACHIEVEMENTS.filter(a => unlocked.has(a.id)).reduce((s, a) => s + a.bb, 0);

    return (
        <div>
            {/* Toast */}
            {toast && (
                <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50">
                    <div className="flex items-center gap-3 bg-yellow-400 text-yellow-950 font-black px-5 py-3.5 rounded-2xl shadow-2xl border-2 border-yellow-300 animate-bounce">
                        <Trophy className="w-7 h-7 shrink-0" />
                        <div>
                            <div className="text-base">{toast.name} unlocked!</div>
                            <div className="text-xs font-semibold opacity-80">+{toast.bb} BlazesBucks</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-3xl font-black text-gray-900">Achievements</h1>
                    <p className="text-gray-500 mt-1">{totalUnlocked}/{totalAchievements} unlocked</p>
                </div>
                <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 px-4 py-2 rounded-xl">
                    <Trophy className="w-5 h-5 text-yellow-500" />
                    <span className="font-black text-yellow-700">{totalBBEarned} BB</span>
                </div>
            </div>

            {/* Overall progress */}
            <div className="mb-6">
                <div className="w-full h-2.5 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-500 rounded-full transition-all duration-700"
                        style={{ width: `${(totalUnlocked / totalAchievements) * 100}%` }} />
                </div>
            </div>

            {/* Floating tooltip */}
            {hover && (
                <div className="fixed pointer-events-none" style={{ left: hover.x, top: hover.y, transform: 'translate(-50%, -100%)', zIndex: 9999 }}>
                    <div className={`w-48 rounded-xl p-3 shadow-2xl border text-center ${hover.isUnlocked ? 'bg-white border-green-200' : 'bg-gray-900 border-gray-700'}`}>
                        <div className={`font-black text-sm ${hover.isUnlocked ? 'text-gray-900' : 'text-white'}`}>{hover.ach.name}</div>
                        <div className={`text-xs mt-1 ${hover.isUnlocked ? 'text-gray-500' : 'text-gray-400'}`}>{hover.ach.desc}</div>
                        <div className={`text-xs font-bold mt-1.5 ${hover.isUnlocked ? 'text-green-600' : 'text-yellow-400'}`}>
                            {hover.isUnlocked ? 'Unlocked' : `+${hover.ach.bb} BB`}
                        </div>
                    </div>
                    <div className={`w-2.5 h-2.5 rotate-45 mx-auto -mt-1.5 border-r border-b ${hover.isUnlocked ? 'bg-white border-green-200' : 'bg-gray-900 border-gray-700'}`} />
                </div>
            )}

            {/* Achievement tree */}
            <div className="space-y-2">
                {CATEGORIES.map(cat => {
                    const catUnlocked = cat.achievements.filter(a => unlocked.has(a.id)).length;
                    const allDone = catUnlocked === cat.achievements.length;

                    return (
                        <div key={cat.id} className={`bg-white rounded-2xl border ${allDone ? 'border-green-300' : 'border-gray-200'}`}>
                            {/* Category header */}
                            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
                                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: cat.color + '20' }}>
                                    <span className="text-xs font-black" style={{ color: cat.color }}>{catUnlocked}</span>
                                </div>
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="font-black text-gray-900 text-sm">{cat.label}</span>
                                        {allDone && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-bold">COMPLETE</span>}
                                    </div>
                                </div>
                                <span className="text-xs font-bold text-gray-400">{catUnlocked}/{cat.achievements.length}</span>
                            </div>

                            {/* Achievement chain */}
                            <div className="px-5 py-4 overflow-x-auto">
                                <div className="flex items-start gap-0 min-w-min">
                                    {cat.achievements.map((ach, i) => {
                                        const isUnlocked = unlocked.has(ach.id);
                                        return (
                                            <div key={ach.id} className="flex items-start">
                                                {/* Horizontal connector */}
                                                {i > 0 && (
                                                    <div className="flex items-center self-center mt-2">
                                                        <div className={`w-6 h-0.5 ${isUnlocked ? 'bg-green-400' : 'bg-gray-200'}`} />
                                                    </div>
                                                )}
                                                <AchNode
                                                    ach={ach}
                                                    isUnlocked={isUnlocked}
                                                    color={cat.color}
                                                    onHover={(a, u, rect) => setHover({ ach: a, isUnlocked: u, x: rect.left + rect.width / 2, y: rect.top - 8 })}
                                                    onLeave={() => setHover(null)}
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
