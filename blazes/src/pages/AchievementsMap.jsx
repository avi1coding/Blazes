import { useState, useEffect } from 'react';
import {
  Lock, Trophy, Star, Zap, Target, Calendar, TrendingUp, BookOpen, Clock, BarChart3, Award, Brain, Flame, Crown, Shirt, Users, Gamepad2, GraduationCap, ClipboardList, Layers, UserPlus,
  Vault, Waves, Sparkles, Sun, Moon, Puzzle, ListOrdered, MapPin, Music, Calculator, CheckSquare, ShoppingBag, Compass, Globe, Handshake,
} from 'lucide-react';

const STUDENT_CATEGORIES = [
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
    {
        id: 'live_modes', label: 'Live Modes', color: '#dc2626',
        achievements: [
            { id: 'vault_first', bb: 10, name: 'Into the Vault', desc: 'Play a game of Vault', icon: Vault },
            { id: 'vault_regular', bb: 30, name: 'Vault Regular', desc: 'Play Vault 25 times', icon: Vault },
            { id: 'vault_master', bb: 70, name: 'Vault Master', desc: 'Play Vault 100 times', icon: Vault },
            { id: 'vault_champion', bb: 40, name: 'Vault Champion', desc: 'Reach 300 points in Vault', icon: Trophy },
            { id: 'vault_victor', bb: 50, name: 'Vault Victor', desc: 'Finish #1 in a Vault game', icon: Crown },
            { id: 'undertow_first', bb: 10, name: 'Caught the Current', desc: 'Play a game of Undertow', icon: Waves },
            { id: 'undertow_regular', bb: 30, name: 'Undertow Regular', desc: 'Play Undertow 25 times', icon: Waves },
            { id: 'undertow_master', bb: 70, name: 'Undertow Master', desc: 'Play Undertow 100 times', icon: Waves },
            { id: 'undertow_champion', bb: 40, name: 'Undertow Champion', desc: 'Reach 300 points in Undertow', icon: Trophy },
            { id: 'undertow_victor', bb: 50, name: 'Undertow Victor', desc: 'Finish #1 in an Undertow game', icon: Crown },
            { id: 'fracture_first', bb: 10, name: 'First Crack', desc: 'Play a game of Fracture', icon: Sparkles },
            { id: 'fracture_regular', bb: 30, name: 'Fracture Regular', desc: 'Play Fracture 25 times', icon: Sparkles },
            { id: 'fracture_master', bb: 70, name: 'Fracture Master', desc: 'Play Fracture 100 times', icon: Sparkles },
            { id: 'fracture_champion', bb: 40, name: 'Fracture Champion', desc: 'Reach 300 points in Fracture', icon: Trophy },
            { id: 'fracture_victor', bb: 50, name: 'Fracture Victor', desc: 'Finish #1 in a Fracture game', icon: Crown },
            { id: 'eclipse_first', bb: 10, name: 'First Light', desc: 'Play a game of Eclipse', icon: Sun },
            { id: 'eclipse_regular', bb: 30, name: 'Eclipse Regular', desc: 'Play Eclipse 25 times', icon: Sun },
            { id: 'eclipse_master', bb: 70, name: 'Eclipse Master', desc: 'Play Eclipse 100 times', icon: Sun },
            { id: 'eclipse_champion', bb: 40, name: 'Eclipse Champion', desc: 'Reach 50 points in Eclipse', icon: Trophy },
            { id: 'eclipse_victor', bb: 50, name: 'Eclipse Victor', desc: 'Finish #1 in an Eclipse game', icon: Crown },
            { id: 'endless_explorer', bb: 50, name: 'Endless Explorer', desc: 'Play all 4 live modes', icon: Compass },
            { id: 'endless_veteran', bb: 150, name: 'Endless Veteran', desc: '250 live mode games total', icon: Crown },
        ]
    },
    {
        id: 'question_types', label: 'Question Type Mastery', color: '#3b82f6',
        achievements: [
            { id: 'sa_novice', bb: 15, name: 'Short Answer Novice', desc: '10 short answer correct', icon: BookOpen },
            { id: 'sa_expert', bb: 35, name: 'Short Answer Expert', desc: '50 short answer correct', icon: BookOpen },
            { id: 'sa_master', bb: 70, name: 'Short Answer Master', desc: '100 short answer correct', icon: BookOpen },
            { id: 'fb_novice', bb: 15, name: 'Fill in the Blank Novice', desc: '10 fill-in-the-blank correct', icon: Target },
            { id: 'fb_expert', bb: 35, name: 'Fill in the Blank Expert', desc: '50 fill-in-the-blank correct', icon: Target },
            { id: 'fb_master', bb: 70, name: 'Fill in the Blank Master', desc: '100 fill-in-the-blank correct', icon: Target },
            { id: 'match_novice', bb: 15, name: 'Matching Novice', desc: '10 matching questions correct', icon: Puzzle },
            { id: 'match_expert', bb: 35, name: 'Matching Expert', desc: '50 matching questions correct', icon: Puzzle },
            { id: 'match_master', bb: 70, name: 'Matching Master', desc: '100 matching questions correct', icon: Puzzle },
            { id: 'order_novice', bb: 15, name: 'Ordering Novice', desc: '10 ordering questions correct', icon: ListOrdered },
            { id: 'order_expert', bb: 35, name: 'Ordering Expert', desc: '50 ordering questions correct', icon: ListOrdered },
            { id: 'order_master', bb: 70, name: 'Ordering Master', desc: '100 ordering questions correct', icon: ListOrdered },
            { id: 'label_novice', bb: 15, name: 'Image Labeling Novice', desc: '10 image labels correct', icon: MapPin },
            { id: 'label_expert', bb: 35, name: 'Image Labeling Expert', desc: '50 image labels correct', icon: MapPin },
            { id: 'label_master', bb: 70, name: 'Image Labeling Master', desc: '100 image labels correct', icon: MapPin },
            { id: 'audio_novice', bb: 15, name: 'Audio Novice', desc: '10 audio questions correct', icon: Music },
            { id: 'audio_expert', bb: 35, name: 'Audio Expert', desc: '50 audio questions correct', icon: Music },
            { id: 'audio_master', bb: 70, name: 'Audio Master', desc: '100 audio questions correct', icon: Music },
            { id: 'math_novice', bb: 15, name: 'Equation Novice', desc: '10 math equations correct', icon: Calculator },
            { id: 'math_expert', bb: 35, name: 'Equation Expert', desc: '50 math equations correct', icon: Calculator },
            { id: 'math_master', bb: 70, name: 'Equation Master', desc: '100 math equations correct', icon: Calculator },
            { id: 'multi_novice', bb: 15, name: 'Multi-Select Novice', desc: '10 multi-select correct', icon: CheckSquare },
            { id: 'multi_expert', bb: 35, name: 'Multi-Select Expert', desc: '50 multi-select correct', icon: CheckSquare },
            { id: 'multi_master', bb: 70, name: 'Multi-Select Master', desc: '100 multi-select correct', icon: CheckSquare },
        ]
    },
    {
        id: 'time_rhythm', label: 'Time & Rhythm', color: '#f59e0b',
        achievements: [
            { id: 'early_bird', bb: 20, name: 'Early Bird', desc: 'Answer correctly before 7am', icon: Sun },
            { id: 'night_owl', bb: 20, name: 'Night Owl', desc: 'Answer correctly after 11pm', icon: Moon },
            { id: 'weekend_learner', bb: 20, name: 'Weekend Learner', desc: 'Play on both Saturday and Sunday', icon: Calendar },
            { id: 'monday_motivation', bb: 15, name: 'Monday Motivation', desc: 'Play on a Monday', icon: Calendar },
        ]
    },
    {
        id: 'kits_subjects', label: 'Kit & Subject Variety', color: '#22c55e',
        achievements: [
            { id: 'kit_explorer_5', bb: 20, name: 'Kit Explorer', desc: 'Play 5 different kits', icon: Compass },
            { id: 'kit_explorer_10', bb: 40, name: 'Kit Wanderer', desc: 'Play 10 different kits', icon: Compass },
            { id: 'kit_explorer_20', bb: 80, name: 'Kit Nomad', desc: 'Play 20 different kits', icon: Compass },
            { id: 'kit_explorer_30', bb: 130, name: 'Kit Cartographer', desc: 'Play 30 different kits', icon: Globe },
            { id: 'subject_connoisseur', bb: 50, name: 'Subject Connoisseur', desc: '5 different subjects', icon: BookOpen },
            { id: 'subject_polymath', bb: 90, name: 'Subject Polymath', desc: '8 different subjects', icon: Brain },
            { id: 'polyglot', bb: 150, name: 'Polyglot', desc: '10 different subjects', icon: Globe },
        ]
    },
    {
        id: 'skin_tiers', label: 'Skin Tiers', color: '#a855f7',
        achievements: [
            { id: 'own_uncommon', bb: 15, name: 'Stepping Up', desc: 'Own an Uncommon+ skin', icon: Shirt },
            { id: 'own_rare', bb: 30, name: 'Rare Find', desc: 'Own a Rare+ skin', icon: Shirt },
            { id: 'own_epic', bb: 60, name: 'Epic Taste', desc: 'Own an Epic+ skin', icon: Shirt },
            { id: 'own_legendary', bb: 100, name: 'Legendary Status', desc: 'Own a Legendary+ skin', icon: Crown },
            { id: 'own_mythic', bb: 200, name: 'Mythic', desc: 'Own a Mythic skin', icon: Crown },
        ]
    },
    {
        id: 'deep_ladders', label: 'Records', color: '#ef4444',
        achievements: [
            { id: 'club_25000', bb: 400, name: '25K', desc: '25,000 correct answers', icon: Trophy },
            { id: 'club_50000', bb: 600, name: '50K', desc: '50,000 correct answers', icon: Trophy },
            { id: 'club_100000', bb: 1000, name: '100K', desc: '100,000 correct answers', icon: Crown },
            { id: 'streak_75', bb: 200, name: '75 in a Row', desc: '75 correct in a row', icon: Flame },
            { id: 'streak_100', bb: 350, name: '100 in a Row', desc: '100 correct in a row', icon: Crown },
            { id: 'flawless_10', bb: 120, name: 'Flawless x10', desc: '10 games with 100% accuracy', icon: Star },
            { id: 'flawless_20', bb: 250, name: 'Flawless x20', desc: '20 games with 100% accuracy', icon: Crown },
            { id: 'accuracy_untouchable', bb: 150, name: 'Untouchable Accuracy', desc: '95%+ accuracy (100+ answers)', icon: Target },
            { id: 'marathoner_500', bb: 250, name: 'Marathoner', desc: '500 games played (3+ min)', icon: Gamepad2 },
            { id: 'marathoner_1000', bb: 500, name: 'Ultramarathoner', desc: '1,000 games played (3+ min)', icon: Crown },
            { id: 'fortune_100k', bb: 300, name: 'Fortune: 100K', desc: 'Earn 100,000 BB total', icon: BarChart3 },
            { id: 'fortune_250k', bb: 600, name: 'Fortune: 250K', desc: 'Earn 250,000 BB total', icon: Crown },
            { id: 'streak_180', bb: 400, name: 'Half Year Streak', desc: '180-day play streak', icon: Calendar },
            { id: 'streak_365', bb: 800, name: 'Full Year Streak', desc: '365-day play streak', icon: Crown },
            { id: 'unrivaled', bb: 250, name: 'Unrivaled', desc: 'Win 75 multiplayer games', icon: Crown },
            { id: 'centurion', bb: 400, name: 'Centurion', desc: 'Win 100 multiplayer games', icon: Crown },
            { id: 'dedicated_60days', bb: 80, name: '60 Days In', desc: 'Play on 60 different days', icon: Calendar },
            { id: 'dedicated_180days', bb: 200, name: '180 Days In', desc: 'Play on 180 different days', icon: Calendar },
            { id: 'season_grinder', bb: 60, name: 'Season Grinder', desc: 'Earn 5,000 lifetime season XP', icon: Zap },
        ]
    },
    {
        id: 'spending', label: 'Spending', color: '#eab308',
        achievements: [
            { id: 'first_purchase', bb: 10, name: 'First Purchase', desc: 'Spend BlazesBucks for the first time', icon: ShoppingBag },
            { id: 'big_spender', bb: 40, name: 'Big Spender', desc: 'Spend 1,000 BB total', icon: ShoppingBag },
            { id: 'shopaholic', bb: 90, name: 'Shopaholic', desc: 'Spend 5,000 BB total', icon: ShoppingBag },
        ]
    },
    {
        id: 'assignments_classroom', label: 'Assignments & Classroom', color: '#8b5cf6',
        achievements: [
            { id: 'homework_starter', bb: 15, name: 'Homework Starter', desc: 'Complete your first assignment', icon: ClipboardList },
            { id: 'homework_regular', bb: 50, name: 'Homework Regular', desc: 'Complete 10 assignments', icon: ClipboardList },
            { id: 'homework_champion', bb: 100, name: 'Homework Champion', desc: 'Complete 25 assignments', icon: ClipboardList },
            { id: 'joined_classroom', bb: 10, name: 'Enrolled', desc: 'Join a classroom', icon: GraduationCap },
            { id: 'joined_multiple_classrooms', bb: 30, name: 'Multi-Classroom', desc: 'Join 3 classrooms', icon: GraduationCap },
        ]
    },
    {
        id: 'social', label: 'Social', color: '#06b6d4',
        achievements: [
            { id: 'met_5_players', bb: 20, name: 'Making Friends', desc: 'Play with 5 different classmates', icon: Handshake },
            { id: 'met_20_players', bb: 50, name: 'Well Connected', desc: 'Play with 20 different classmates', icon: Users },
            { id: 'met_50_players', bb: 100, name: 'Class Celebrity', desc: 'Play with 50 different classmates', icon: Crown },
            { id: 'versatile_player', bb: 40, name: 'Versatile Player', desc: 'Play a 2-player and a 20+ player game', icon: Layers },
            { id: 'renaissance_learner', bb: 100, name: 'Renaissance Learner', desc: 'Answer every question type correctly', icon: Brain },
            { id: 'small_group_champion', bb: 30, name: 'Small Group Champion', desc: 'Win a 2-4 player game', icon: Trophy },
            { id: 'small_group_king', bb: 70, name: 'Small Group King', desc: 'Win 5 small-group games', icon: Crown },
        ]
    },
    {
        id: 'misc', label: 'Misc', color: '#64748b',
        achievements: [
            { id: 'ultra_fast', bb: 60, name: 'Ultra Fast', desc: 'Correct in under 0.5 seconds', icon: Zap },
            { id: 'consistent_10', bb: 100, name: 'Ten in a Row', desc: '10 games in a row 90%+', icon: TrendingUp },
            { id: 'error_analyst_master', bb: 90, name: 'Error Analyst Master', desc: 'Review missed questions 50x', icon: BarChart3 },
            { id: 'mode_master', bb: 60, name: 'Mode Master', desc: 'Play every game mode', icon: Layers },
        ]
    },
];

// A teacher never answers questions, so the student catalog above has
// nothing to offer them. This one rewards the things a teacher actually
// does: building kits, growing a classroom, hosting games, setting
// assignments. IDs (server-side too) are prefixed t_ so they can never
// collide with a student achievement id.
const TEACHER_CATEGORIES = [
    {
        id: 'getting_started', label: 'Getting Started', color: '#f97316',
        achievements: [
            { id: 't_first_kit', bb: 10, name: 'First Kit', desc: 'Create your first question kit', icon: BookOpen },
            { id: 't_first_classroom', bb: 15, name: 'Classroom Ready', desc: 'Create your first classroom', icon: GraduationCap },
            { id: 't_first_host', bb: 15, name: 'Game Master', desc: 'Host your first game', icon: Gamepad2 },
            { id: 't_first_assignment', bb: 15, name: 'Homework Time', desc: 'Create your first assignment', icon: ClipboardList },
            { id: 't_dressed_up', bb: 20, name: 'Dressed Up', desc: 'Buy your first skin', icon: Shirt },
            { id: 't_mode_explorer', bb: 60, name: 'Mode Explorer', desc: 'Host every game mode at least once', icon: Layers },
        ]
    },
    {
        id: 'kits', label: 'Kit Building', color: '#3b82f6',
        achievements: [
            { id: 't_kit_builder', bb: 30, name: 'Kit Builder', desc: 'Create 5 kits', icon: BookOpen },
            { id: 't_kit_curator', bb: 70, name: 'Kit Curator', desc: 'Create 15 kits', icon: BookOpen },
            { id: 't_kit_library', bb: 150, name: 'Kit Library', desc: 'Create 30 kits', icon: Trophy },
        ]
    },
    {
        id: 'classroom', label: 'Classroom', color: '#8b5cf6',
        achievements: [
            { id: 't_growing_class', bb: 30, name: 'Growing Class', desc: '10 students across your classrooms', icon: Users },
            { id: 't_full_roster', bb: 70, name: 'Full Roster', desc: '30 students across your classrooms', icon: Users },
            { id: 't_small_school', bb: 200, name: 'Small School', desc: '100 students across your classrooms', icon: Crown },
            { id: 't_team_teaching', bb: 20, name: 'Team Teaching', desc: 'Add a co-teacher to a classroom', icon: UserPlus },
        ]
    },
    {
        id: 'hosting', label: 'Hosting', color: '#ef4444',
        achievements: [
            { id: 't_regular_host', bb: 40, name: 'Regular Host', desc: 'Host 10 games', icon: Gamepad2 },
            { id: 't_veteran_host', bb: 100, name: 'Veteran Host', desc: 'Host 50 games', icon: Gamepad2 },
            { id: 't_marathon_host', bb: 300, name: 'Marathon Host', desc: 'Host 200 games', icon: Crown },
            { id: 't_big_crowd', bb: 40, name: 'Big Crowd', desc: 'Host a game with 15+ players', icon: Users },
            { id: 't_packed_house', bb: 90, name: 'Packed House', desc: 'Host a game with 30+ players', icon: Users },
        ]
    },
    {
        id: 'assignments', label: 'Assignments', color: '#22c55e',
        achievements: [
            { id: 't_assignment_giver', bb: 50, name: 'Assignment Giver', desc: 'Create 10 assignments', icon: ClipboardList },
            { id: 't_homework_hero', bb: 100, name: 'Homework Hero', desc: 'Create 25 assignments', icon: ClipboardList },
            { id: 't_grading_grind', bb: 90, name: 'Grading Grind', desc: '50 completed submissions across your assignments', icon: Target },
        ]
    },
    {
        id: 'economy', label: 'BlazesBucks & Consistency', color: '#eab308',
        achievements: [
            { id: 't_first_hundred', bb: 10, name: 'First Hundred', desc: 'Earn 100 BB total', icon: BarChart3 },
            { id: 't_thousand_club', bb: 40, name: 'Thousand Club', desc: 'Earn 1,000 BB total', icon: BarChart3 },
            { id: 't_five_grand', bb: 100, name: 'Five Grand', desc: 'Earn 5,000 BB total', icon: Trophy },
            { id: 't_two_weeks', bb: 60, name: 'Two Weeks', desc: '14-day streak', icon: Calendar },
            { id: 't_one_month', bb: 120, name: 'One Month', desc: '30-day streak', icon: Calendar },
        ]
    },
];

const ALL_STUDENT_ACHIEVEMENTS = STUDENT_CATEGORIES.flatMap(c => c.achievements);
const ALL_TEACHER_ACHIEVEMENTS = TEACHER_CATEGORIES.flatMap(c => c.achievements);

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

export default function AchievementsMap({ userId, role }) {
    const isTeacher = role === 'teacher';
    const CATEGORIES = isTeacher ? TEACHER_CATEGORIES : STUDENT_CATEGORIES;
    const ALL_ACHIEVEMENTS = isTeacher ? ALL_TEACHER_ACHIEVEMENTS : ALL_STUDENT_ACHIEVEMENTS;

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

    // Scoped to this catalog, not unlocked.size: a teacher who has ever
    // hosted with "host plays" on also holds student achievement ids in the
    // same account, and unlocked.size counts every id regardless of catalog.
    const totalUnlocked = ALL_ACHIEVEMENTS.filter(a => unlocked.has(a.id)).length;
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
