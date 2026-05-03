import React, { useState, useEffect, useCallback } from 'react';
import {
    Check, Lock, ShoppingCart, Archive, Package, AlertTriangle, CheckCircle,
    // Common
    Wind, Flame, Globe, Droplet, Sun, Snowflake, Zap, Moon, TreePine, Volume2,
    // Uncommon
    Cog, Skull, Diamond, Atom, Orbit, CloudFog, Clock, CloudLightning, Hourglass,
    Mountain, Ghost, Cpu, Telescope, Flower, CircleOff,
    // Rare
    Scale, Sparkles, Tornado, Lightbulb, Gem, Sparkle, Waves, Cloud, MountainSnow, Sprout,
    // Epic
    Activity, CloudSnow, Pickaxe, CloudRain, Stars,
    // Legendary
    MoreHorizontal, Target, Star, AlarmClock,
    // Mythic
    Trophy, Infinity as InfinityIcon, Crown, FlameKindling,
    // Misc replacements for de-duplication
    Asterisk, Music,
    // Mythological (Season 1)
    Anchor, Bone, Shield, Sword, Eye, Crosshair, Feather, Heart, Hammer, Wine, Wheat,
} from 'lucide-react';

// TEMP: flip to true to render every skin as owned/unlocked so the user can
// visually review all orb designs without actually buying them. This only
// affects the local UI — the server still tracks real ownership, so equip
// requests will be locally previewed but won't persist.
const PREVIEW_ALL_SKINS = true;

// ─── Skin icons — mapped to lucide-react components ────────────────────
// Each skin id resolves to a professionally-designed Lucide icon component.
// Some concepts share the same icon where the closest match is reused
// (e.g. "blaze" + "fire" both → Flame); the orb gradient + tier glow keep
// them visually distinct.
const SKIN_ICONS = {
    // Common — elemental
    air: Wind,
    fire: Flame,
    earth: Globe,
    water: Droplet,
    light: Sun,
    ice: Snowflake,
    lightning: Zap,
    shadow: Moon,
    wood: TreePine,
    sound: Volume2,
    // Uncommon
    metal: Cog,
    poison: Skull,
    crystal: Diamond,
    plasma: Atom,
    gravity: Orbit,
    mist: CloudFog,
    time: Clock,
    storm: CloudLightning,
    sand: Hourglass,
    lava: Mountain,
    spirit: Ghost,
    tech: Cpu,
    cosmic: Telescope,
    nature: Flower,
    void: CircleOff,
    // Rare
    order: Scale,
    astral: Sparkles,
    chaos: Tornado,
    neon: Lightbulb,
    mythic: Gem,
    ember: Sparkle,
    wave: Waves,
    gale: Cloud,
    stone: MountainSnow,
    vine: Sprout,
    // Epic
    thunder: Activity,
    frost: CloudSnow,
    quake: Pickaxe,
    tempest: CloudRain,
    // Legendary
    rift: MoreHorizontal,
    nova: Asterisk,
    singularity: Target,
    chrono: AlarmClock,
    // Mythic
    celestial: Stars,
    star: Star,
    apex: Trophy,
    omega: InfinityIcon,
    blaze: FlameKindling,
    // Season 1: Mythological
    zeus: Crown,
    poseidon: Anchor,
    hades: Bone,
    athena: Shield,
    ares: Sword,
    apollo: Music,
    medusa: Eye,
    artemis: Crosshair,
    hermes: Feather,
    aphrodite: Heart,
    hephaestus: Hammer,
    dionysus: Wine,
    demeter: Wheat,
};

// ─── Rarity border styles ───────────────────────────────────────────────
const RARITY_BORDERS = {
    Basic: { border: 'none', animation: '' },
    Common: { border: '2px solid', animation: '' },
    Uncommon: { border: '2px solid', animation: '' },
    Rare: { border: '2.5px solid', animation: 'rare-glow 2s ease-in-out infinite' },
    Epic: { border: '3px solid', animation: 'epic-glow 1.5s ease-in-out infinite' },
    Legendary: { border: '3px solid', animation: 'legendary-glow 1.2s ease-in-out infinite' },
    Mythic: { border: '3.5px solid', animation: 'mythic-glow 1s ease-in-out infinite' },
};

// ─── Name colors by tier ────────────────────────────────────────────────
export const TIER_NAME_COLORS = {
    Basic: '#374151',
    Common: '#0284c7',
    Uncommon: '#16a34a',
    Rare: '#7c3aed',
    Epic: '#ea580c',
    Legendary: '#b45309',
    Mythic: '#be185d',
};

// ─── Level requirements for shop ────────────────────────────────────────
export const TIER_LEVEL_REQ = {
    Basic: 0, Common: 0, Uncommon: 0, Rare: 5, Epic: 15, Legendary: 30, Mythic: 50,
};

// ─── Season Packs ───────────────────────────────────────────────────────
export const SEASON_PACKS = [
    {
        id: 'mythological',
        name: 'Mythological Pack',
        season: 1,
        cost: 30, // BB per open
        description: 'Legends of Olympus — 13 limited edition skins',
        bg: 'linear-gradient(135deg,#7c3aed,#1e1b4b)',
        skins: [
            // id, name, tier, drop chance %
            { id: 'zeus', chance: 2 },
            { id: 'poseidon', chance: 2 },
            { id: 'hades', chance: 4 },
            { id: 'athena', chance: 4 },
            { id: 'ares', chance: 7 },
            { id: 'apollo', chance: 7 },
            { id: 'medusa', chance: 7 },
            { id: 'artemis', chance: 10 },
            { id: 'hermes', chance: 10 },
            { id: 'aphrodite', chance: 10 },
            { id: 'hephaestus', chance: 13 },
            { id: 'dionysus', chance: 12 },
            { id: 'demeter', chance: 12 },
        ]
    }
];

// ─── Seasonal skins ─────────────────────────────────────────────────────
export const SEASONAL_SKINS = [
    // Season 1: Mythological
    { id: 'zeus',       name: 'Zeus',       cost: 0, emoji: '', bg: 'linear-gradient(135deg,#fbbf24,#f59e0b,#7c3aed)', glow: '#fbbf24', tier: 'Mythic',    tc: '#b45309', season: 1, pack: 'mythological' },
    { id: 'poseidon',   name: 'Poseidon',   cost: 0, emoji: '', bg: 'linear-gradient(135deg,#0ea5e9,#1e3a5f,#06b6d4)', glow: '#0ea5e9', tier: 'Mythic',    tc: '#0369a1', season: 1, pack: 'mythological' },
    { id: 'hades',      name: 'Hades',      cost: 0, emoji: '', bg: 'linear-gradient(135deg,#374151,#111827,#581c87)', glow: '#6b7280', tier: 'Legendary', tc: '#4b5563', season: 1, pack: 'mythological' },
    { id: 'athena',     name: 'Athena',     cost: 0, emoji: '', bg: 'linear-gradient(135deg,#e0e7ff,#818cf8,#c084fc)', glow: '#818cf8', tier: 'Legendary', tc: '#6366f1', season: 1, pack: 'mythological' },
    { id: 'ares',       name: 'Ares',       cost: 0, emoji: '', bg: 'linear-gradient(135deg,#dc2626,#7f1d1d,#991b1b)', glow: '#dc2626', tier: 'Epic',      tc: '#b91c1c', season: 1, pack: 'mythological' },
    { id: 'apollo',     name: 'Apollo',     cost: 0, emoji: '', bg: 'linear-gradient(135deg,#fde68a,#f59e0b,#ea580c)', glow: '#fbbf24', tier: 'Epic',      tc: '#d97706', season: 1, pack: 'mythological' },
    { id: 'medusa',     name: 'Medusa',     cost: 0, emoji: '', bg: 'linear-gradient(135deg,#4ade80,#065f46,#374151)', glow: '#4ade80', tier: 'Epic',      tc: '#059669', season: 1, pack: 'mythological' },
    { id: 'artemis',    name: 'Artemis',    cost: 0, emoji: '', bg: 'linear-gradient(135deg,#c084fc,#6d28d9,#1e1b4b)', glow: '#a78bfa', tier: 'Rare',      tc: '#7c3aed', season: 1, pack: 'mythological' },
    { id: 'hermes',     name: 'Hermes',     cost: 0, emoji: '', bg: 'linear-gradient(135deg,#67e8f9,#fbbf24,#f97316)', glow: '#67e8f9', tier: 'Rare',      tc: '#0891b2', season: 1, pack: 'mythological' },
    { id: 'aphrodite',  name: 'Aphrodite',  cost: 0, emoji: '', bg: 'linear-gradient(135deg,#f9a8d4,#ec4899,#be185d)', glow: '#f472b6', tier: 'Rare',      tc: '#be185d', season: 1, pack: 'mythological' },
    { id: 'hephaestus', name: 'Hephaestus', cost: 0, emoji: '', bg: 'linear-gradient(135deg,#f97316,#78350f,#92400e)', glow: '#f97316', tier: 'Uncommon',  tc: '#c2410c', season: 1, pack: 'mythological' },
    { id: 'dionysus',   name: 'Dionysus',   cost: 0, emoji: '', bg: 'linear-gradient(135deg,#7c3aed,#ec4899,#f472b6)', glow: '#a855f7', tier: 'Uncommon',  tc: '#7c3aed', season: 1, pack: 'mythological' },
    { id: 'demeter',    name: 'Demeter',    cost: 0, emoji: '', bg: 'linear-gradient(135deg,#4ade80,#fbbf24,#65a30d)', glow: '#4ade80', tier: 'Uncommon',  tc: '#16a34a', season: 1, pack: 'mythological' },
];

// ─── Full skin catalogue ───────────────────────────────────────────────────
export const AVATAR_SKINS = [
    // Basic (free)
    { id: 'basic-red',    name: 'Red',    cost: 0, emoji: '', bg: 'linear-gradient(135deg,#ef4444,#dc2626)', glow: '#ef4444', tier: 'Basic', tc: '#b91c1c' },
    { id: 'basic-orange', name: 'Orange', cost: 0, emoji: '', bg: 'linear-gradient(135deg,#f97316,#ea580c)', glow: '#f97316', tier: 'Basic', tc: '#c2410c' },
    { id: 'basic-yellow', name: 'Yellow', cost: 0, emoji: '', bg: 'linear-gradient(135deg,#fbbf24,#d97706)', glow: '#fbbf24', tier: 'Basic', tc: '#92400e' },
    { id: 'basic-green',  name: 'Green',  cost: 0, emoji: '', bg: 'linear-gradient(135deg,#22c55e,#15803d)', glow: '#22c55e', tier: 'Basic', tc: '#15803d' },
    { id: 'basic-blue',   name: 'Blue',   cost: 0, emoji: '', bg: 'linear-gradient(135deg,#3b82f6,#1d4ed8)', glow: '#3b82f6', tier: 'Basic', tc: '#1d4ed8' },
    { id: 'basic-purple', name: 'Purple', cost: 0, emoji: '', bg: 'linear-gradient(135deg,#a855f7,#7e22ce)', glow: '#a855f7', tier: 'Basic', tc: '#7e22ce' },
    { id: 'basic-white',  name: 'White',  cost: 0, emoji: '', bg: 'linear-gradient(135deg,#f8fafc,#e2e8f0)', glow: '#cbd5e1', tier: 'Basic', tc: '#64748b' },
    { id: 'basic-brown',  name: 'Brown',  cost: 0, emoji: '', bg: 'linear-gradient(135deg,#92400e,#78350f)', glow: '#b45309', tier: 'Basic', tc: '#78350f' },
    { id: 'basic-black',  name: 'Black',  cost: 0, emoji: '', bg: 'linear-gradient(135deg,#374151,#111827)', glow: '#4b5563', tier: 'Basic', tc: '#6b7280' },
    // Common
    { id: 'air', name: 'Air', cost: 190, emoji: '💨', bg: 'linear-gradient(135deg,#bae6fd,#e2e8f0)', glow: '#7dd3fc', tier: 'Common', tc: '#0284c7' },
    { id: 'fire', name: 'Fire', cost: 210, emoji: '🔥', bg: 'linear-gradient(135deg,#f97316,#dc2626)', glow: '#f97316', tier: 'Common', tc: '#c2410c' },
    { id: 'earth', name: 'Earth', cost: 220, emoji: '🌍', bg: 'linear-gradient(135deg,#15803d,#92400e)', glow: '#16a34a', tier: 'Common', tc: '#15803d' },
    { id: 'water', name: 'Water', cost: 230, emoji: '💧', bg: 'linear-gradient(135deg,#38bdf8,#0891b2)', glow: '#22d3ee', tier: 'Common', tc: '#0369a1' },
    { id: 'light', name: 'Light', cost: 240, emoji: '☀️', bg: 'linear-gradient(135deg,#fef08a,#fbbf24)', glow: '#fbbf24', tier: 'Common', tc: '#b45309' },
    { id: 'ice', name: 'Ice', cost: 250, emoji: '❄️', bg: 'linear-gradient(135deg,#a5f3fc,#60a5fa)', glow: '#67e8f9', tier: 'Common', tc: '#0891b2' },
    { id: 'lightning', name: 'Lightning', cost: 260, emoji: '⚡', bg: 'linear-gradient(135deg,#facc15,#8b5cf6)', glow: '#facc15', tier: 'Common', tc: '#d97706' },
    { id: 'shadow', name: 'Shadow', cost: 270, emoji: '🌑', bg: 'linear-gradient(135deg,#1f2937,#111827)', glow: '#6b7280', tier: 'Common', tc: '#6b7280' },
    { id: 'wood', name: 'Wood', cost: 280, emoji: '🌿', bg: 'linear-gradient(135deg,#65a30d,#166534)', glow: '#84cc16', tier: 'Common', tc: '#16a34a' },
    { id: 'sound', name: 'Sound', cost: 290, emoji: '🎵', bg: 'linear-gradient(135deg,#a78bfa,#ec4899)', glow: '#a78bfa', tier: 'Common', tc: '#7c3aed' },
    // Uncommon
    { id: 'metal', name: 'Metal', cost: 300, emoji: '⚙️', bg: 'linear-gradient(135deg,#94a3b8,#52525b)', glow: '#94a3b8', tier: 'Uncommon', tc: '#475569' },
    { id: 'poison', name: 'Poison', cost: 310, emoji: '☠️', bg: 'linear-gradient(135deg,#7c3aed,#166534)', glow: '#7c3aed', tier: 'Uncommon', tc: '#7c3aed' },
    { id: 'crystal', name: 'Crystal', cost: 320, emoji: '💎', bg: 'linear-gradient(135deg,#67e8f9,#6366f1)', glow: '#06b6d4', tier: 'Uncommon', tc: '#0891b2' },
    { id: 'plasma', name: 'Plasma', cost: 330, emoji: '🌀', bg: 'linear-gradient(135deg,#e879f9,#3b82f6)', glow: '#e879f9', tier: 'Uncommon', tc: '#a21caf' },
    { id: 'gravity', name: 'Gravity', cost: 340, emoji: '🌌', bg: 'linear-gradient(135deg,#3730a3,#581c87)', glow: '#4338ca', tier: 'Uncommon', tc: '#4338ca' },
    { id: 'mist', name: 'Mist', cost: 340, emoji: '🌫️', bg: 'linear-gradient(135deg,#cbd5e1,#93c5fd)', glow: '#94a3b8', tier: 'Uncommon', tc: '#64748b' },
    { id: 'time', name: 'Time', cost: 350, emoji: '⏳', bg: 'linear-gradient(135deg,#f59e0b,#4f46e5)', glow: '#f59e0b', tier: 'Uncommon', tc: '#b45309' },
    { id: 'storm', name: 'Storm', cost: 360, emoji: '⛈️', bg: 'linear-gradient(135deg,#374151,#1e3a5f)', glow: '#475569', tier: 'Uncommon', tc: '#334155' },
    { id: 'sand', name: 'Sand', cost: 370, emoji: '🏜️', bg: 'linear-gradient(135deg,#fcd34d,#ca8a04)', glow: '#fbbf24', tier: 'Uncommon', tc: '#a16207' },
    { id: 'lava', name: 'Lava', cost: 380, emoji: '🌋', bg: 'linear-gradient(135deg,#b91c1c,#7c2d12)', glow: '#dc2626', tier: 'Uncommon', tc: '#991b1b' },
    { id: 'spirit', name: 'Spirit', cost: 390, emoji: '👻', bg: 'linear-gradient(135deg,#ddd6fe,#93c5fd)', glow: '#c4b5fd', tier: 'Uncommon', tc: '#7c3aed' },
    { id: 'tech', name: 'Tech', cost: 400, emoji: '🤖', bg: 'linear-gradient(135deg,#0891b2,#134e4a)', glow: '#06b6d4', tier: 'Uncommon', tc: '#0e7490' },
    { id: 'cosmic', name: 'Cosmic', cost: 410, emoji: '🔭', bg: 'linear-gradient(135deg,#5b21b6,#1e1b4b)', glow: '#7c3aed', tier: 'Uncommon', tc: '#6d28d9' },
    { id: 'nature', name: 'Nature', cost: 410, emoji: '🌺', bg: 'linear-gradient(135deg,#4ade80,#059669)', glow: '#4ade80', tier: 'Uncommon', tc: '#16a34a' },
    { id: 'void', name: 'Void', cost: 420, emoji: '🕳️', bg: 'linear-gradient(135deg,#000000,#111827)', glow: '#374151', tier: 'Uncommon', tc: '#6b7280' },
    // Rare
    { id: 'order', name: 'Order', cost: 430, emoji: '⚖️', bg: 'linear-gradient(135deg,#f1f5f9,#bfdbfe)', glow: '#bfdbfe', tier: 'Rare', tc: '#3b82f6' },
    { id: 'astral', name: 'Astral', cost: 440, emoji: '✨', bg: 'linear-gradient(135deg,#818cf8,#9333ea)', glow: '#818cf8', tier: 'Rare', tc: '#4f46e5' },
    { id: 'chaos', name: 'Chaos', cost: 450, emoji: '🌪️', bg: 'linear-gradient(135deg,#f97316,#ec4899,#9333ea)', glow: '#f97316', tier: 'Rare', tc: '#c2410c' },
    { id: 'neon', name: 'Neon', cost: 460, emoji: '💡', bg: 'linear-gradient(135deg,#f472b6,#22d3ee)', glow: '#f472b6', tier: 'Rare', tc: '#be185d' },
    { id: 'mythic', name: 'Mythic', cost: 480, emoji: '🦄', bg: 'linear-gradient(135deg,#fb7185,#e879f9,#8b5cf6)', glow: '#e879f9', tier: 'Rare', tc: '#a21caf' },
    { id: 'ember', name: 'Ember', cost: 520, emoji: '🪵', bg: 'linear-gradient(135deg,#ef4444,#b45309)', glow: '#ef4444', tier: 'Rare', tc: '#b91c1c' },
    { id: 'wave', name: 'Wave', cost: 540, emoji: '🌊', bg: 'linear-gradient(135deg,#3b82f6,#0f766e)', glow: '#3b82f6', tier: 'Rare', tc: '#1d4ed8' },
    { id: 'gale', name: 'Gale', cost: 560, emoji: '🌬️', bg: 'linear-gradient(135deg,#7dd3fc,#6366f1)', glow: '#38bdf8', tier: 'Rare', tc: '#0369a1' },
    { id: 'stone', name: 'Stone', cost: 580, emoji: '🪨', bg: 'linear-gradient(135deg,#78716c,#44403c)', glow: '#78716c', tier: 'Rare', tc: '#57534e' },
    { id: 'vine', name: 'Vine', cost: 600, emoji: '🌱', bg: 'linear-gradient(135deg,#22c55e,#4d7c0f)', glow: '#22c55e', tier: 'Rare', tc: '#15803d' },
    // Epic
    { id: 'thunder', name: 'Thunder', cost: 620, emoji: '🌩️', bg: 'linear-gradient(135deg,#fde047,#1d4ed8)', glow: '#fde047', tier: 'Epic', tc: '#ca8a04' },
    { id: 'frost', name: 'Frost', cost: 640, emoji: '🧊', bg: 'linear-gradient(135deg,#bae6fd,#0891b2)', glow: '#bae6fd', tier: 'Epic', tc: '#0369a1' },
    { id: 'quake', name: 'Quake', cost: 660, emoji: '🫨', bg: 'linear-gradient(135deg,#d97706,#991b1b)', glow: '#d97706', tier: 'Epic', tc: '#92400e' },
    { id: 'tempest', name: 'Tempest', cost: 680, emoji: '🌀', bg: 'linear-gradient(135deg,#475569,#1e3a5f)', glow: '#64748b', tier: 'Epic', tc: '#334155' },
    // Legendary
    { id: 'rift', name: 'Rift', cost: 900, emoji: '🌀', bg: 'linear-gradient(135deg,#7e22ce,#000000)', glow: '#9333ea', tier: 'Legendary', tc: '#7e22ce' },
    { id: 'nova', name: 'Nova', cost: 1000, emoji: '💫', bg: 'linear-gradient(135deg,#fde047,#ec4899,#9333ea)', glow: '#facc15', tier: 'Legendary', tc: '#b45309' },
    { id: 'singularity', name: 'Singularity', cost: 1150, emoji: '⚫', bg: 'linear-gradient(135deg,#000000,#312e81,#581c87)', glow: '#4f46e5', tier: 'Legendary', tc: '#4338ca' },
    { id: 'chrono', name: 'Chrono', cost: 1450, emoji: '⌚', bg: 'linear-gradient(135deg,#fbbf24,#14b8a6,#4338ca)', glow: '#f59e0b', tier: 'Legendary', tc: '#b45309' },
    // Mythic
    { id: 'celestial', name: 'Celestial', cost: 1600, emoji: '🌠', bg: 'linear-gradient(135deg,#a5b4fc,#c084fc,#f9a8d4)', glow: '#818cf8', tier: 'Mythic', tc: '#4f46e5' },
    { id: 'star', name: 'Star', cost: 1750, emoji: '⭐', bg: 'linear-gradient(135deg,#fef9c3,#fde68a,#fb923c)', glow: '#fde68a', tier: 'Mythic', tc: '#b45309' },
    { id: 'apex', name: 'Apex', cost: 1900, emoji: '👑', bg: 'linear-gradient(135deg,#ef4444,#facc15,#f97316)', glow: '#ef4444', tier: 'Mythic', tc: '#b91c1c' },
    { id: 'omega', name: 'Omega', cost: 2000, emoji: '♾️', bg: 'linear-gradient(135deg,#7c3aed,#e879f9,#f472b6)', glow: '#7c3aed', tier: 'Mythic', tc: '#6d28d9' },
    { id: 'blaze', name: 'Blaze', cost: 3000, emoji: '🔥', bg: 'linear-gradient(135deg,#ff0000,#ff4500,#ff8c00,#ffd700)', glow: '#ff4500', tier: 'Mythic', tc: '#dc2626' },
];

const ALL_SKINS = [...AVATAR_SKINS, ...SEASONAL_SKINS];
const SKIN_BY_ID = Object.fromEntries(ALL_SKINS.map(s => [s.id, s]));

const FREE_SKIN_IDS = AVATAR_SKINS.filter(s => s.cost === 0).map(s => s.id);

const TIER_COLORS = {
    Basic: { badge: '#6b7280', bg: '#f9fafb' },
    Common: { badge: '#0284c7', bg: '#eff6ff' },
    Uncommon: { badge: '#16a34a', bg: '#f0fdf4' },
    Rare: { badge: '#7c3aed', bg: '#faf5ff' },
    Epic: { badge: '#ea580c', bg: '#fff7ed' },
    Legendary: { badge: '#b45309', bg: '#fffbeb' },
    Mythic: { badge: '#be185d', bg: '#fdf2f8' },
};

// Small avatar for nav / lobby — shows icon, animated border by rarity, profile frame
// Global tier cache — populated by skin fetches
const _tierCache = {};
export function cacheTier(userId, tier) { _tierCache[userId] = tier; }
export function getCachedTier(userId) { return _tierCache[userId] || null; }

export function isBlazesPlusCached() {
    try { return localStorage.getItem('blazes_tier') === 'blazes_plus'; } catch { return false; }
}

export function AvatarPreview({ skinId, initial, size = 40, showFrame = true, isPlus = false, userId }) {
    // Auto-detect from cache if userId provided and isPlus not explicitly set
    if (!isPlus && userId && getCachedTier(userId) === 'blazes_plus') isPlus = true;
    const skin = SKIN_BY_ID[skinId];
    const bg = skin ? skin.bg : 'linear-gradient(135deg,#ef4444,#f97316)';
    const glow = skin ? skin.glow : '#f97316';
    const tier = skin?.tier || 'Basic';
    const rb = RARITY_BORDERS[tier] || RARITY_BORDERS.Basic;
    const IconComp = skin ? SKIN_ICONS[skin.id] : null;
    // Round to integer pixels — fractional sizes cause sub-pixel blur on SVG strokes
    const iconSize = Math.round(size * 0.55);
    const tierRank = { Basic: 0, Common: 1, Uncommon: 2, Rare: 3, Epic: 4, Legendary: 5, Mythic: 6 }[tier] || 0;
    const plusRingWidth = Math.max(3, Math.round(size * 0.04));
    const plusOuterSize = isPlus ? size + plusRingWidth * 2 + 4 : 0;
    const frameSize = isPlus ? plusOuterSize : size + (showFrame && tier !== 'Basic' ? Math.round(size * 0.2) : 0);
    const frameColor = skin?.glow || '#9ca3af';

    return (
        <div style={{ width: frameSize, height: frameSize, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative' }}>
            {/* Blazes Plus spinning ring */}
            {isPlus && (
                <>
                    <div style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'conic-gradient(from 0deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ef4444)',
                        animation: 'spin 3s linear infinite',
                    }} />
                    <div style={{
                        position: 'absolute', inset: plusRingWidth, borderRadius: '50%',
                        background: 'inherit',
                    }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#18181b' }} />
                    </div>
                </>
            )}
            {/* Animated frame ring for Rare+ (only if not Plus — Plus replaces it) */}
            {!isPlus && showFrame && tier !== 'Basic' && tier !== 'Common' && tier !== 'Uncommon' && (
                <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: rb.border, borderColor: frameColor,
                    animation: rb.animation || 'none',
                }} />
            )}
            {/* Inner circle — gradient orb with a strong colored halo + clean dark rim */}
            <div style={{
                width: size, height: size, borderRadius: '50%',
                backgroundImage: `radial-gradient(circle at 32% 26%, rgba(255,255,255,0.3), rgba(255,255,255,0) 55%), ${bg}`,
                boxShadow: `0 0 ${Math.round(size * 0.35)}px ${glow}cc, 0 0 ${Math.round(size * 0.65)}px ${glow}66, inset 0 0 0 1.5px rgba(0,0,0,0.22), inset 0 ${Math.round(size * 0.04)}px ${Math.round(size * 0.08)}px rgba(255,255,255,0.2)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative', zIndex: 2, overflow: 'hidden',
            }}>
                {IconComp ? (
                    <IconComp
                        size={iconSize}
                        color="white"
                        strokeWidth={3}
                        absoluteStrokeWidth
                        style={{
                            position: 'relative', zIndex: 2,
                            filter: `drop-shadow(0 0 ${Math.max(3, Math.round(size * 0.14))}px ${glow}) drop-shadow(0 0 ${Math.max(6, Math.round(size * 0.28))}px ${glow}) drop-shadow(0 0 ${Math.max(10, Math.round(size * 0.5))}px ${glow}99)`,
                        }}
                    />
                ) : skin ? (
                    /* Basic / iconless skin — show the gradient orb alone, no letter */
                    null
                ) : (
                    <span style={{ color: 'white', fontWeight: 900, fontSize: size * 0.42, textShadow: '0 2px 6px rgba(0,0,0,0.5)', position: 'relative', zIndex: 2 }}>{initial || '?'}</span>
                )}
                {/* Sparkle dots for high-tier skins */}
                {(tier === 'Legendary' || tier === 'Mythic') && (
                    <>
                        <span style={{
                            position: 'absolute', top: '14%', right: '18%',
                            width: Math.max(3, size * 0.07), height: Math.max(3, size * 0.07), borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 70%)',
                            animation: 'skin-sparkle 2.4s ease-in-out infinite',
                        }} />
                        <span style={{
                            position: 'absolute', bottom: '20%', left: '18%',
                            width: Math.max(2, size * 0.05), height: Math.max(2, size * 0.05), borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(255,255,255,1) 0%, rgba(255,255,255,0) 70%)',
                            animation: 'skin-sparkle 3.1s ease-in-out infinite 0.7s',
                        }} />
                    </>
                )}
                {/* Conic shimmer rotation for Mythic only — subtle rainbow sweep */}
                {tier === 'Mythic' && (
                    <span style={{
                        position: 'absolute', inset: 0, borderRadius: '50%',
                        background: 'conic-gradient(from 0deg, rgba(255,255,255,0) 0deg, rgba(255,255,255,0.18) 60deg, rgba(255,255,255,0) 120deg, rgba(255,255,255,0) 360deg)',
                        animation: 'skin-shimmer 4s linear infinite',
                        mixBlendMode: 'screen', pointerEvents: 'none',
                    }} />
                )}
            </div>
        </div>
    );
}

// Get name color for a skin tier
export function getNameColor(skinId) {
    const skin = SKIN_BY_ID[skinId];
    return TIER_NAME_COLORS[skin?.tier] || TIER_NAME_COLORS.Basic;
}

// ─── Countdown helper ─────────────────────────────────────────────────────
function useCountdown(expiresAt) {
    const [remaining, setRemaining] = useState('');
    useEffect(() => {
        const tick = () => {
            if (!expiresAt) return;
            const ms = new Date(expiresAt).getTime() - Date.now();
            if (ms <= 0) { setRemaining('Refreshing...'); return; }
            const h = Math.floor(ms / 3600000);
            const m = Math.floor((ms % 3600000) / 60000);
            const s = Math.floor((ms % 60000) / 1000);
            setRemaining(`${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`);
        };
        tick();
        const id = setInterval(tick, 1000);
        return () => clearInterval(id);
    }, [expiresAt]);
    return remaining;
}

// ─── Shop card (shows all skins; out-of-stock are locked) ────────────────────
function ShopCard({ skin, inStock, isOwned, isEquipped, canAfford, isBuying, onBuy, onEquip, showChance, ownedCount = 0 }) {
    const [hovered, setHovered] = useState(false);
    const tc = TIER_COLORS[skin.tier] || TIER_COLORS.Common;
    const dimmed = !inStock && !isOwned;
    const TIER_GLOW_OPACITY = { Common: 0, Uncommon: '14', Rare: '2e', Epic: '52', Legendary: '80', Mythic: 'bf' };
    const glowHex = TIER_GLOW_OPACITY[skin.tier];
    const glowShadow = glowHex && glowHex !== 0 ? `0 0 18px ${skin.glow}${glowHex}` : null;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: dimmed ? '#f9fafb' : 'white',
                borderRadius: 18, padding: 16, position: 'relative',
                border: `2px solid ${isEquipped ? '#dc2626' : isOwned ? '#4ade80' : inStock ? (glowShadow ? skin.glow + '55' : tc.badge + '40') : '#e5e7eb'}`,
                boxShadow: isEquipped
                    ? `0 4px 20px ${skin.glow}60`
                    : inStock && glowShadow
                        ? `${glowShadow}, 0 1px 6px rgba(0,0,0,0.06)`
                        : '0 1px 4px rgba(0,0,0,0.05)',
                transition: 'transform 0.12s',
                transform: hovered && inStock ? 'translateY(-3px)' : 'translateY(0)',
                opacity: dimmed ? 0.55 : 1,
            }}
        >
            {/* Tier badge */}
            <div style={{
                position: 'absolute', top: 8, left: 10, fontSize: 10, fontWeight: 800,
                color: tc.badge, background: tc.bg, borderRadius: 6, padding: '1px 6px'
            }}>
                {skin.tier}
            </div>

            {/* In-stock indicator */}
            {inStock && !isOwned && !isEquipped && (
                <div style={{
                    position: 'absolute', top: 8, right: 8,
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#22c55e',
                    boxShadow: '0 0 6px #22c55e80',
                }} />
            )}

            {/* Owned / equipped check */}
            {(isOwned || isEquipped) && (
                <div style={{
                    position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%',
                    background: isEquipped ? '#dc2626' : '#22c55e',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                </div>
            )}

            {/* Avatar preview — same rich orb everywhere; locked skins show the orb dimmed
                with a lock badge so the shopper can still see what they're working toward. */}
            <div style={{
                width: '100%', height: 96, marginTop: 22, marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
            }}>
                <div style={{
                    position: 'relative',
                    filter: dimmed ? 'grayscale(0.6) brightness(0.7)' : 'none',
                }}>
                    <AvatarPreview skinId={skin.id} initial={skin.name?.[0]?.toUpperCase()} size={72} />
                </div>
                {dimmed && (
                    <div style={{
                        position: 'absolute', bottom: -4, right: 'calc(50% - 50px)',
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'rgba(17,24,39,0.92)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid white',
                    }}>
                        <Lock size={13} color="white" strokeWidth={2.5} />
                    </div>
                )}
            </div>

            {/* Name */}
            <div style={{ fontWeight: 900, fontSize: 13, textAlign: 'center', color: dimmed ? '#9ca3af' : '#111827', marginBottom: 6 }}>
                {skin.name}
            </div>

            {/* Chance pill */}
            {showChance && (
                <div style={{ textAlign: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', borderRadius: 20, padding: '2px 8px' }}>
                        {showChance}% chance
                    </span>
                </div>
            )}

            {/* Not in stock label */}
            {!inStock && !isOwned && (
                <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#9ca3af', background: '#f3f4f6', borderRadius: 8, padding: '5px 0' }}>
                    Not in Stock
                </div>
            )}

            {/* Actions */}
            {ownedCount > 1 && (
                <div style={{ textAlign: 'center', fontSize: 10, fontWeight: 800, color: '#6b7280', marginBottom: 2 }}>
                    Owned: x{ownedCount}
                </div>
            )}
            {isEquipped ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, fontWeight: 800, color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '6px 0' }}>
                        <Check size={13} strokeWidth={3} /> Equipped
                    </div>
                    {inStock && onBuy && (
                        <button onClick={() => onBuy(skin)} disabled={!canAfford || isBuying} style={{
                            width: '100%', padding: '5px 0', borderRadius: 8, fontSize: 11, fontWeight: 800,
                            background: canAfford ? '#fef3c7' : '#f3f4f6', color: canAfford ? '#92400e' : '#9ca3af',
                            border: 'none', cursor: canAfford ? 'pointer' : 'not-allowed', opacity: isBuying ? 0.6 : 1
                        }}>
                            {isBuying ? '...' : canAfford ? `Buy Again · ${skin.cost}` : 'Need more'}
                        </button>
                    )}
                </div>
            ) : isOwned ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {onEquip && (
                        <button onClick={() => onEquip(skin)} style={{
                            width: '100%', padding: '6px 0', borderRadius: 8,
                            fontSize: 12, fontWeight: 800, background: '#f0fdf4', color: '#15803d', border: 'none', cursor: 'pointer'
                        }}>
                            Equip
                        </button>
                    )}
                    {inStock && onBuy && (
                        <button onClick={() => onBuy(skin)} disabled={!canAfford || isBuying} style={{
                            width: '100%', padding: '5px 0', borderRadius: 8, fontSize: 11, fontWeight: 800,
                            background: canAfford ? '#fef3c7' : '#f3f4f6', color: canAfford ? '#92400e' : '#9ca3af',
                            border: 'none', cursor: canAfford ? 'pointer' : 'not-allowed', opacity: isBuying ? 0.6 : 1
                        }}>
                            {isBuying ? '...' : canAfford ? `Buy Again · ${skin.cost}` : 'Need more'}
                        </button>
                    )}
                </div>
            ) : inStock && onBuy ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 6 }}>
                        <img src="/blazes-coin.png" style={{ width: 15, height: 15, mixBlendMode: 'multiply' }} alt="" />
                        <span style={{ fontSize: 13, fontWeight: 900, color: canAfford ? '#b45309' : '#9ca3af' }}>
                            {skin.cost.toLocaleString()}
                        </span>
                    </div>
                    <button onClick={() => onBuy(skin)} disabled={!canAfford || isBuying} style={{
                        width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 800,
                        background: canAfford ? '#fbbf24' : '#f3f4f6',
                        color: canAfford ? '#78350f' : '#9ca3af',
                        border: 'none', cursor: canAfford ? 'pointer' : 'not-allowed', opacity: isBuying ? 0.6 : 1
                    }}>
                        {isBuying ? '...' : canAfford ? 'Buy' : 'Need more'}
                    </button>
                </>
            ) : null}
        </div>
    );
}

// ─── Shared skin card ─────────────────────────────────────────────────────
function SkinCard({ skin, isOwned, isEquipped, canAfford, isBuying, onBuy, onEquip, showChance, ownedCount = 0 }) {
    const [hovered, setHovered] = useState(false);
    const tc = TIER_COLORS[skin.tier] || TIER_COLORS.Common;
    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                background: 'white', borderRadius: 18, padding: 16, position: 'relative',
                border: `2px solid ${isEquipped ? '#dc2626' : isOwned ? '#4ade80' : '#e5e7eb'}`,
                boxShadow: isEquipped ? `0 4px 20px ${skin.glow}40` : '0 1px 6px rgba(0,0,0,0.06)',
                transition: 'transform 0.12s, box-shadow 0.12s',
                transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
            }}
        >
            {/* Tier badge */}
            <div style={{
                position: 'absolute', top: 8, left: 10, fontSize: 10, fontWeight: 800,
                color: tc.badge, background: tc.bg, borderRadius: 6, padding: '1px 6px'
            }}>
                {skin.tier}
            </div>

            {/* Owned / equipped check */}
            {(isOwned || isEquipped) && (
                <div style={{
                    position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderRadius: '50%',
                    background: isEquipped ? '#dc2626' : '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <Check size={12} color="white" strokeWidth={3} />
                </div>
            )}

            {/* Avatar circle — same rich orb; locked dimmed + lock badge */}
            <div style={{
                width: '100%', height: 96, marginTop: 22, marginBottom: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
            }}>
                <div style={{
                    position: 'relative',
                    filter: !isOwned ? 'grayscale(0.6) brightness(0.7)' : 'none',
                }}>
                    <AvatarPreview skinId={skin.id} initial={skin.name?.[0]?.toUpperCase()} size={72} />
                </div>
                {!isOwned && (
                    <div style={{
                        position: 'absolute', bottom: -4, right: 'calc(50% - 50px)',
                        width: 26, height: 26, borderRadius: '50%',
                        background: 'rgba(17,24,39,0.92)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid white',
                    }}>
                        <Lock size={13} color="white" strokeWidth={2.5} />
                    </div>
                )}
            </div>

            {/* Name + count */}
            <div style={{ fontWeight: 900, fontSize: 13, textAlign: 'center', color: '#111827', marginBottom: 2 }}>
                {skin.name}
            </div>
            {ownedCount > 1 && (
                <div style={{ textAlign: 'center', marginBottom: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: '#6b7280', background: '#f3f4f6', borderRadius: 8, padding: '2px 8px' }}>
                        x{ownedCount}
                    </span>
                </div>
            )}

            {/* Chance pill (shop only) */}
            {showChance && (
                <div style={{ textAlign: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#6b7280', background: '#f3f4f6', borderRadius: 20, padding: '2px 8px' }}>
                        {showChance}% chance
                    </span>
                </div>
            )}

            {/* Action */}
            {isEquipped ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, fontWeight: 800, color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '6px 0' }}>
                    <Check size={13} strokeWidth={3} /> Equipped
                </div>
            ) : isOwned ? (
                onEquip && (
                    <button onClick={() => onEquip(skin)} style={{
                        width: '100%', padding: '6px 0', borderRadius: 8,
                        fontSize: 12, fontWeight: 800, background: '#f0fdf4', color: '#15803d', border: 'none', cursor: 'pointer'
                    }}>
                        Equip
                    </button>
                )
            ) : onBuy ? (
                <>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 6 }}>
                        <img src="/blazes-coin.png" style={{ width: 15, height: 15, mixBlendMode: 'multiply' }} alt="" />
                        <span style={{ fontSize: 13, fontWeight: 900, color: canAfford ? '#b45309' : '#9ca3af' }}>
                            {skin.cost.toLocaleString()}
                        </span>
                    </div>
                    <button onClick={() => onBuy(skin)} disabled={!canAfford || isBuying} style={{
                        width: '100%', padding: '6px 0', borderRadius: 8, fontSize: 12, fontWeight: 800,
                        background: canAfford ? '#fbbf24' : '#f3f4f6',
                        color: canAfford ? '#78350f' : '#9ca3af',
                        border: 'none', cursor: canAfford ? 'pointer' : 'not-allowed', opacity: isBuying ? 0.6 : 1
                    }}>
                        {isBuying ? '...' : canAfford ? 'Buy' : 'Need more 🪙'}
                    </button>
                </>
            ) : null}
        </div>
    );
}

// ─── Main SkinsPage ─────────────────────────────────────────────────────────
export default function SkinsPage({ userId, blazesBucks, onBBChange, onSkinEquip }) {
    const [tab, setTab] = useState('shop');
    const [owned, setOwned] = useState(() => {
        if (PREVIEW_ALL_SKINS) {
            return new Set(['default', ...AVATAR_SKINS.map(s => s.id), ...SEASONAL_SKINS.map(s => s.id)]);
        }
        return new Set(['default', ...FREE_SKIN_IDS]);
    });
    const [ownedCounts, setOwnedCounts] = useState({});
    const [equipped, setEquipped] = useState({ avatar_skin: 'default', bar_skin: 'default' });
    const [stock, setStock] = useState([]);       // array of skin IDs
    const [expiresAt, setExpiresAt] = useState(null);
    const [balance, setBalance] = useState(blazesBucks || 0);
    const [purchasing, setPurchasing] = useState(null);
    const [toast, setToast] = useState(null);
    const [loadingOwned, setLoadingOwned] = useState(true);
    const [loadingStock, setLoadingStock] = useState(true);
    const [userLevel, setUserLevel] = useState(1);
    const [packCount, setPackCount] = useState(1);
    const [packResults, setPackResults] = useState(null);
    const [openingPacks, setOpeningPacks] = useState(false);
    const [revealIndex, setRevealIndex] = useState(-1); // -1 = not revealing, 0+ = currently revealing this index
    const [revealPhase, setRevealPhase] = useState('idle'); // idle, opening, revealing, done
    const [userTier, setUserTier] = useState('free');

    const base = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:5000';
    const hasSeasonPass = ['blazes_plus'].includes(userTier);

    // Fetch user tier
    useEffect(() => {
        if (!userId) return;
        fetch(`${base}/api/subscription/${userId}`).then(r => r.json()).then(d => setUserTier(d.tier || 'free')).catch(() => {});
    }, [userId]);

    // Fetch season level for shop gating
    useEffect(() => {
        if (!userId) return;
        fetch(`${base}/api/season/progress/${userId}`)
            .then(r => r.json())
            .then(d => setUserLevel(d.level || 1))
            .catch(() => {});
    }, [userId, base]);
    const countdown = useCountdown(expiresAt);

    // Sync balance prop
    useEffect(() => { setBalance(blazesBucks || 0); }, [blazesBucks]);

    // Load owned skins + equipped
    useEffect(() => {
        if (!userId) return;
        fetch(`${base}/api/skins/${userId}`)
            .then(r => r.json())
            .then(d => {
                if (!PREVIEW_ALL_SKINS) {
                    setOwned(new Set(['default', ...FREE_SKIN_IDS, ...(d.owned || []).map(s => s.skin_id)]));
                }
                const counts = {};
                (d.owned || []).forEach(s => { counts[s.skin_id] = s.count || 1; });
                setOwnedCounts(counts);
                if (d.equipped) setEquipped(d.equipped);
            })
            .catch(() => { })
            .finally(() => setLoadingOwned(false));
    }, [userId]);

    // Load current stock (force=true regenerates immediately via POST)
    const loadStock = useCallback((force = false) => {
        setLoadingStock(true);
        const url = force ? `${base}/api/skins/stock/refresh` : `${base}/api/skins/stock`;
        fetch(url, { method: force ? 'POST' : 'GET' })
            .then(r => r.json())
            .then(d => {
                setStock(d.skinIds || []);
                setExpiresAt(d.expiresAt);
            })
            .catch(() => { })
            .finally(() => setLoadingStock(false));
    }, [base]);

    useEffect(() => { loadStock(); }, [loadStock]);

    // Auto-toast dismiss
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(() => setToast(null), 3000);
        return () => clearTimeout(t);
    }, [toast]);

    const showToast = (msg, type = 'success') => setToast({ msg, type });

    const handleBuy = async (skin) => {
        if (purchasing) return;
        setPurchasing(skin.id);
        try {
            const r = await fetch(`${base}/api/skins/purchase`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, skinId: skin.id, skinType: 'avatar', cost: skin.cost })
            });
            const d = await r.json();
            if (r.ok) {
                setOwned(prev => new Set([...prev, skin.id]));
                setBalance(d.balance);
                onBBChange?.(d.balance);
                showToast(`${skin.name} purchased!`);
            } else {
                showToast(d.error || 'Purchase failed', 'error');
            }
        } catch { showToast('Connection error', 'error'); }
        setPurchasing(null);
    };

    const handleEquip = async (skin) => {
        setEquipped(prev => ({ ...prev, avatar_skin: skin.id }));
        onSkinEquip?.(skin.id);  // notify parent to update nav avatar instantly
        try {
            await fetch(`${base}/api/skins/equip`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, skinId: skin.id, skinType: 'avatar' })
            });
            showToast(`${skin.name} equipped!`);
        } catch { }
    };

    const refetchOwned = () => {
        fetch(`${base}/api/skins/${userId}`)
            .then(r => r.json())
            .then(d => {
                if (!PREVIEW_ALL_SKINS) {
                    setOwned(new Set(['default', ...FREE_SKIN_IDS, ...(d.owned || []).map(s => s.skin_id)]));
                }
                const counts = {};
                (d.owned || []).forEach(s => { counts[s.skin_id] = s.count || 1; });
                setOwnedCounts(counts);
                if (d.equipped) setEquipped(d.equipped);
            })
            .catch(() => { });
    };

    const [pendingResults, setPendingResults] = useState(null);
    const [currentOpenIndex, setCurrentOpenIndex] = useState(0);

    const handleBuyPacks = async () => {
        if (openingPacks) return;
        setOpeningPacks(true);
        setPackResults(null);
        setRevealIndex(-1);
        setRevealPhase('idle');
        setCurrentOpenIndex(0);
        try {
            const r = await fetch(`${base}/api/packs/open`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, packId: 'mythological', count: packCount })
            });
            const d = await r.json();
            if (r.ok) {
                const prevOwned = new Set(owned);
                setBalance(d.newBalance);
                onBBChange?.(d.newBalance);
                setPendingResults({ items: d.results, previousOwned: prevOwned });
                setRevealPhase('waiting'); // show the pack to tap
            } else {
                showToast(d.error || 'Failed to open packs', 'error');
            }
        } catch { showToast('Connection error', 'error'); }
        setOpeningPacks(false);
    };

    const handleTapPack = async () => {
        if (!pendingResults || revealPhase === 'opening') return;
        const item = pendingResults.items[currentOpenIndex];
        if (!item) return;

        setRevealPhase('opening');
        // Wait for pack burst animation
        await new Promise(res => setTimeout(res, 1200));
        // Show the single result
        setRevealPhase('showResult');
    };

    const handleNextPack = () => {
        const nextIdx = currentOpenIndex + 1;
        if (nextIdx < pendingResults.items.length) {
            setCurrentOpenIndex(nextIdx);
            setRevealPhase('waiting');
        } else {
            handleClosePacks();
        }
    };

    const handleSkipAll = () => {
        handleClosePacks();
    };

    const handleClosePacks = () => {
        setPendingResults(null);
        setPackResults(null);
        setRevealPhase('idle');
        setRevealIndex(-1);
        setCurrentOpenIndex(0);
    };

    const TIER_COLORS = {
        Mythic: { bg: 'linear-gradient(135deg,#fbbf24,#f59e0b)', glow: '#fbbf24', text: '#92400e' },
        Legendary: { bg: 'linear-gradient(135deg,#7e22ce,#a855f7)', glow: '#9333ea', text: '#7e22ce' },
        Epic: { bg: 'linear-gradient(135deg,#dc2626,#ef4444)', glow: '#dc2626', text: '#991b1b' },
        Rare: { bg: 'linear-gradient(135deg,#3b82f6,#60a5fa)', glow: '#3b82f6', text: '#1d4ed8' },
        Uncommon: { bg: 'linear-gradient(135deg,#22c55e,#4ade80)', glow: '#22c55e', text: '#15803d' },
    };

    // Stock skins (enriched with catalogue data)
    const stockSkins = stock.map(id => SKIN_BY_ID[id]).filter(Boolean);

    // Collection: all skins, owned first
    const seasonalIds = new Set(SEASONAL_SKINS.map(s => s.id));
    const ownedSkins = AVATAR_SKINS.filter(s => owned.has(s.id) || s.cost === 0);
    const lockedSkins = AVATAR_SKINS.filter(s => !owned.has(s.id) && s.cost !== 0);
    const ownedSeasonalSkins = SEASONAL_SKINS.filter(s => owned.has(s.id));

    // Chance lookup (must match backend SKIN_CHANCES)
    const CHANCES = { air:13.5,fire:14.0,earth:13.0,water:13.5,light:12.5,ice:12.0,lightning:14.5,shadow:12.0,wood:11.5,sound:11.0,metal:9.5,poison:8.5,crystal:8.0,plasma:8.0,gravity:7.5,mist:7.5,time:7.0,storm:7.5,sand:7.0,lava:7.0,spirit:6.8,tech:6.8,cosmic:6.5,nature:6.5,void:6.3,order:6.0,astral:5.9,chaos:5.8,neon:5.8,mythic:5.7,ember:5.7,wave:5.6,gale:5.6,stone:5.5,vine:5.5,thunder:3.3,frost:3.2,quake:3.2,tempest:3.1,inferno:3.0,aurora:3.0,rift:2.9,nova:2.9,singularity:2.8,ethereal:2.8,chrono:2.7,celestial:1.6,star:1.3,apex:1.0,omega:0.9,blaze:0.1 };

    return (
        <div>
            {/* Toast */}
            {toast && (
                <div style={{
                    position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 9999,
                    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 16,
                    fontWeight: 900, fontSize: 14, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    color: toast.type === 'error' ? '#991b1b' : '#14532d',
                    border: `2px solid ${toast.type === 'error' ? '#fca5a5' : '#86efac'}`
                }}>
                    {toast.type === 'error'
                        ? <AlertTriangle size={16} strokeWidth={2.5} />
                        : <CheckCircle size={16} strokeWidth={2.5} />}
                    {toast.msg}
                </div>
            )}

            {/* Page header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-gray-900">Skins 🎨</h1>
                    <p className="text-gray-500 mt-1 text-sm">Buy from the shop or equip from your collection</p>
                </div>
                <div className="flex items-center gap-2 bg-yellow-50 border-2 border-yellow-200 px-4 py-2 rounded-2xl">
                    <img src="/blazes-coin.png" className="w-7 h-7" alt="BB" style={{ mixBlendMode: 'multiply' }} />
                    <div>
                        <div className="font-black text-yellow-700 text-lg">{balance.toLocaleString()}</div>
                        <div className="text-xs text-yellow-600 font-semibold">BlazesBucks</div>
                    </div>
                </div>
            </div>

            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 28 }}>
                {[
                    { key: 'shop', icon: <ShoppingCart size={16} />, label: 'Shop' },
                    { key: 'packs', icon: <Package size={16} />, label: 'Packs' },
                    { key: 'collection', icon: <Archive size={16} />, label: 'Collection' },
                ].map(t => (
                    <button key={t.key} onClick={() => setTab(t.key)} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '10px 22px', borderRadius: 12, fontSize: 14, fontWeight: 900, cursor: 'pointer',
                        border: tab === t.key ? '2px solid #dc2626' : '2px solid #e5e7eb',
                        background: tab === t.key ? '#dc2626' : 'white',
                        color: tab === t.key ? 'white' : '#6b7280',
                        boxShadow: tab === t.key ? '0 4px 14px rgba(220,38,38,0.3)' : 'none',
                        transition: 'all 0.15s',
                    }}>
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ── SHOP TAB ──────────────────────────────────────────────── */}
            {tab === 'shop' && (
                <>
                    {/* Stock banner */}
                    <div style={{
                        background: 'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius: 20,
                        padding: '20px 28px', marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}>
                        <div>
                            <div style={{ color: '#c7d2fe', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                                🛒 Current Stock
                            </div>
                            <div style={{ color: 'white', fontSize: 22, fontWeight: 900 }}>
                                {loadingStock ? '...' : `${stockSkins.length} skins available`}
                            </div>
                            <div style={{ color: '#a5b4fc', fontSize: 13, marginTop: 4 }}>
                                Resets every 3 hours
                            </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ color: '#c7d2fe', fontSize: 11, fontWeight: 700, marginBottom: 4 }}>NEXT RESET IN</div>
                            <div style={{ color: '#fde68a', fontSize: 20, fontWeight: 900, fontVariantNumeric: 'tabular-nums' }}>
                                {countdown || '—'}
                            </div>
                        </div>
                    </div>

                    {loadingStock ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 16 }}>
                            {Array.from({ length: 12 }).map((_, i) => (
                                <div key={i} style={{ height: 200, background: '#f3f4f6', borderRadius: 18 }} />
                            ))}
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 16 }}>
                            {AVATAR_SKINS.map(skin => {
                                const levelReq = TIER_LEVEL_REQ[skin.tier] || 0;
                                const levelLocked = userLevel < levelReq;
                                const inStock = (stock.includes(skin.id) || skin.cost === 0) && !levelLocked;
                                const isOwned = owned.has(skin.id) || skin.cost === 0;
                                const isEquipped = equipped.avatar_skin === skin.id;
                                if (levelLocked && !isOwned) {
                                    return (
                                        <div key={skin.id} style={{
                                            background: '#f9fafb', borderRadius: 18, padding: 16,
                                            border: '2px solid #e5e7eb', opacity: 0.5, textAlign: 'center',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                            minHeight: 180,
                                        }}>
                                            <Lock style={{ width: 24, height: 24, color: '#9ca3af', marginBottom: 8 }} />
                                            <div style={{ fontWeight: 900, fontSize: 12, color: '#6b7280' }}>Level {levelReq}</div>
                                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{skin.tier} tier</div>
                                        </div>
                                    );
                                }
                                const count = ownedCounts[skin.id] || 0;
                                const isBasic = skin.cost === 0;
                                return (
                                    <ShopCard key={skin.id} skin={skin}
                                        inStock={inStock}
                                        isOwned={isOwned}
                                        isEquipped={isEquipped}
                                        canAfford={balance >= skin.cost}
                                        isBuying={purchasing === skin.id}
                                        onBuy={inStock && !isBasic ? handleBuy : null}
                                        onEquip={isOwned ? handleEquip : null}
                                        showChance={inStock ? CHANCES[skin.id] : null}
                                        ownedCount={count}
                                    />
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {/* ── PACKS TAB ─────────────────────────────────────────────── */}
            {tab === 'packs' && (() => {
                const pack = SEASON_PACKS[0];
                const RARITY_BG = { Mythic: '#fbbf24', Legendary: '#a855f7', Epic: '#ef4444', Rare: '#3b82f6', Uncommon: '#22c55e' };
                const RARITY_BORDER = { Mythic: '#d97706', Legendary: '#7c3aed', Epic: '#dc2626', Rare: '#2563eb', Uncommon: '#16a34a' };
                return (
                <>
                    {/* Full-width themed background */}
                    <div style={{
                        background: 'linear-gradient(180deg, #1e1b4b 0%, #2d1b69 100%)',
                        borderRadius: 24, padding: '40px 24px 32px', marginBottom: 24,
                        textAlign: 'center', position: 'relative', overflow: 'hidden',
                    }}>
                        {/* Background decorative shapes */}
                        {[...Array(6)].map((_, i) => (
                            <div key={i} style={{
                                position: 'absolute', width: 60 + i * 20, height: 60 + i * 20,
                                borderRadius: 12, background: 'rgba(255,255,255,0.03)',
                                transform: `rotate(${i * 15}deg)`,
                                left: `${10 + i * 14}%`, top: `${-10 + (i % 3) * 30}%`,
                            }} />
                        ))}

                        {/* Pack card image */}
                        <div style={{
                            width: 140, height: 200, margin: '0 auto 20px', borderRadius: 16, position: 'relative',
                            background: 'linear-gradient(160deg, #1a1147 0%, #2d1b69 40%, #4c1d95 100%)',
                            border: '3px solid #d4af37',
                            boxShadow: '0 8px 40px rgba(212,175,55,0.3), 0 0 60px rgba(124,58,237,0.2)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                        }}>
                            {/* Gold corners */}
                            <div style={{ position: 'absolute', top: 6, left: 6, width: 16, height: 16, borderTop: '2px solid #d4af37', borderLeft: '2px solid #d4af37', borderRadius: '3px 0 0 0' }} />
                            <div style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderTop: '2px solid #d4af37', borderRight: '2px solid #d4af37', borderRadius: '0 3px 0 0' }} />
                            <div style={{ position: 'absolute', bottom: 6, left: 6, width: 16, height: 16, borderBottom: '2px solid #d4af37', borderLeft: '2px solid #d4af37', borderRadius: '0 0 0 3px' }} />
                            <div style={{ position: 'absolute', bottom: 6, right: 6, width: 16, height: 16, borderBottom: '2px solid #d4af37', borderRight: '2px solid #d4af37', borderRadius: '0 0 3px 0' }} />
                            <Crown size={48} color="#d4af37" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 8px rgba(212,175,55,0.5))' }} />
                            <div style={{ color: '#d4af37', fontSize: 9, fontWeight: 900, marginTop: 10, letterSpacing: '0.15em' }}>SEASON ONE</div>
                        </div>

                        {/* Pack name */}
                        <h2 style={{ color: 'white', fontSize: 28, fontWeight: 900, marginBottom: 16, letterSpacing: '0.02em', textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                            MYTHOLOGICAL PACK
                        </h2>

                        {/* Season Pass banner */}
                        {!hasSeasonPass && (
                            <div style={{
                                background: 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(99,102,241,0.2) 100%)',
                                border: '1px solid rgba(168,85,247,0.3)',
                                borderRadius: 14, padding: '12px 16px', marginBottom: 20,
                                display: 'flex', alignItems: 'center', gap: 12,
                            }}>
                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 700, flex: 1, textAlign: 'left', lineHeight: 1.4 }}>
                                    Get <span style={{ color: '#d4af37', fontWeight: 900 }}>ALL 13 skins</span> instantly with Season Pass
                                </div>
                                <button onClick={() => window.location.href = '/upgrade'}
                                    style={{
                                        padding: '6px 14px', borderRadius: 8, fontSize: 11, fontWeight: 900,
                                        border: 'none', color: 'white', cursor: 'pointer',
                                        background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
                                        whiteSpace: 'nowrap', flexShrink: 0,
                                    }}>
                                    Season Pass
                                </button>
                            </div>
                        )}

                        {/* Open button */}
                        <button
                            onClick={handleBuyPacks}
                            disabled={openingPacks || balance < packCount * 30}
                            style={{
                                padding: '12px 36px', borderRadius: 12, fontSize: 16, fontWeight: 900,
                                cursor: openingPacks || balance < packCount * 30 ? 'not-allowed' : 'pointer',
                                border: 'none', color: 'white', letterSpacing: '0.05em',
                                background: openingPacks || balance < packCount * 30 ? '#4b5563' : '#d4af37',
                                boxShadow: openingPacks || balance < packCount * 30 ? 'none' : '0 4px 16px rgba(212,175,55,0.4)',
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                            }}
                        >
                            {openingPacks ? 'OPENING...' : 'OPEN FOR'}
                            {!openingPacks && (
                                <>
                                    <img src="/blazes-coin.png" style={{ width: 20, height: 20, mixBlendMode: 'multiply', filter: 'brightness(2)' }} alt="" />
                                    <span>{(packCount * 30).toLocaleString()}</span>
                                </>
                            )}
                        </button>

                        {/* Count controls */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 16 }}>
                            <button onClick={() => setPackCount(Math.max(1, packCount - 1))}
                                className="pack-count-btn"
                                style={{
                                    width: 44, height: 36, borderRadius: 10,
                                    border: '2px solid rgba(212,175,55,0.3)',
                                    background: 'rgba(212,175,55,0.1)',
                                    color: '#d4af37', fontSize: 15, fontWeight: 800,
                                    cursor: 'pointer', transition: 'all 0.15s',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.25)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)'; e.currentTarget.style.transform = 'scale(1.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >-1</button>

                            <div style={{
                                minWidth: 52, height: 36, borderRadius: 10, padding: '0 12px',
                                background: 'rgba(255,255,255,0.08)',
                                border: '2px solid rgba(255,255,255,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                color: 'white', fontSize: 17, fontWeight: 900,
                            }}>
                                {packCount}
                            </div>

                            <button onClick={() => setPackCount(Math.min(50, packCount + 1))}
                                style={{
                                    width: 44, height: 36, borderRadius: 10,
                                    border: '2px solid rgba(212,175,55,0.3)',
                                    background: 'rgba(212,175,55,0.1)',
                                    color: '#d4af37', fontSize: 15, fontWeight: 800,
                                    cursor: 'pointer', transition: 'all 0.15s',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.25)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)'; e.currentTarget.style.transform = 'scale(1.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.1)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >+1</button>

                            <button onClick={() => setPackCount(Math.min(50, packCount + 5))}
                                style={{
                                    width: 44, height: 36, borderRadius: 10,
                                    border: '2px solid rgba(212,175,55,0.3)',
                                    background: 'rgba(212,175,55,0.15)',
                                    color: '#d4af37', fontSize: 15, fontWeight: 800,
                                    cursor: 'pointer', transition: 'all 0.15s',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.3)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.6)'; e.currentTarget.style.transform = 'scale(1.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(212,175,55,0.15)'; e.currentTarget.style.borderColor = 'rgba(212,175,55,0.3)'; e.currentTarget.style.transform = 'scale(1)'; }}
                            >+5</button>
                        </div>

                        {balance < packCount * 30 && (
                            <div style={{ color: '#fca5a5', fontSize: 12, fontWeight: 700, marginTop: 10 }}>
                                Need {(packCount * 30 - balance).toLocaleString()} more BB
                            </div>
                        )}
                    </div>

                    {/* Drop rates grid */}
                    <div style={{
                        background: 'rgba(124,58,237,0.08)', borderRadius: 20, padding: 24,
                        border: '2px solid rgba(124,58,237,0.15)',
                    }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 12 }}>
                            {pack.skins.map(s => {
                                const skinData = SKIN_BY_ID[s.id];
                                const border = RARITY_BORDER[skinData?.tier] || '#4b5563';
                                const isOwned = owned.has(s.id);
                                return (
                                    <div key={s.id} style={{ textAlign: 'center' }}>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 72 }}>
                                            <AvatarPreview skinId={s.id} initial={(skinData?.name || '?')[0].toUpperCase()} size={56} />
                                            {isOwned && (
                                                <div style={{ position: 'absolute', bottom: 0, right: '12%', width: 18, height: 18, borderRadius: '50%', background: '#22c55e', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #1e1b4b', zIndex: 5 }}>
                                                    <Check size={10} color="white" strokeWidth={3} />
                                                </div>
                                            )}
                                        </div>
                                        <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.9)', marginTop: 6 }}>{skinData?.name}</div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: border }}>{s.chance}%</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* ═══ FULL-SCREEN PACK OPENING — MYTHOLOGICAL THEME ═══ */}
                    {pendingResults && revealPhase !== 'idle' && (
                        <div style={{
                            position: 'fixed', inset: 0, zIndex: 200,
                            background: 'radial-gradient(ellipse at 50% 30%, #1a1147 0%, #0c0a1a 50%, #000 100%)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                            overflow: 'hidden',
                        }}>
                            {/* Decorative columns */}
                            <div style={{ position: 'absolute', left: 40, top: '50%', transform: 'translateY(-50%)', opacity: 0.06 }}>
                                <svg width="60" height="300" viewBox="0 0 60 300" fill="white">
                                    <rect x="5" y="20" width="50" height="260" rx="4" />
                                    <rect x="0" y="0" width="60" height="20" rx="3" />
                                    <rect x="0" y="280" width="60" height="20" rx="3" />
                                    <line x1="18" y1="20" x2="18" y2="280" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
                                    <line x1="42" y1="20" x2="42" y2="280" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
                                </svg>
                            </div>
                            <div style={{ position: 'absolute', right: 40, top: '50%', transform: 'translateY(-50%)', opacity: 0.06 }}>
                                <svg width="60" height="300" viewBox="0 0 60 300" fill="white">
                                    <rect x="5" y="20" width="50" height="260" rx="4" />
                                    <rect x="0" y="0" width="60" height="20" rx="3" />
                                    <rect x="0" y="280" width="60" height="20" rx="3" />
                                    <line x1="18" y1="20" x2="18" y2="280" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
                                    <line x1="42" y1="20" x2="42" y2="280" stroke="rgba(0,0,0,0.3)" strokeWidth="2" />
                                </svg>
                            </div>

                            {/* Floating particles */}
                            {[...Array(8)].map((_, i) => (
                                <div key={i} style={{
                                    position: 'absolute',
                                    width: 4, height: 4, borderRadius: '50%',
                                    background: i % 2 === 0 ? '#fbbf24' : '#a78bfa',
                                    left: `${10 + Math.random() * 80}%`,
                                    top: `${10 + Math.random() * 80}%`,
                                    opacity: 0.3,
                                    animation: `packFloat ${2 + i * 0.3}s ease-in-out infinite`,
                                    animationDelay: `${i * 0.2}s`,
                                }} />
                            ))}

                            {/* Counter */}
                            <div style={{ position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)', color: '#d4af37', fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                Pack {currentOpenIndex + 1} of {pendingResults.items.length}
                            </div>

                            {/* Skip all */}

                            {/* STATE: Waiting — mythological pack card */}
                            {revealPhase === 'waiting' && (
                                <div onClick={handleTapPack} style={{ cursor: 'pointer', textAlign: 'center' }}>
                                    <div style={{
                                        width: 170, height: 240, borderRadius: 20, position: 'relative',
                                        background: 'linear-gradient(160deg, #1a1147 0%, #2d1b69 30%, #1a1147 60%, #0f0b2e 100%)',
                                        boxShadow: '0 0 50px rgba(212,175,55,0.3), 0 0 100px rgba(124,58,237,0.2), inset 0 0 30px rgba(212,175,55,0.05)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column',
                                        border: '2px solid rgba(212,175,55,0.5)',
                                        animation: 'packFloat 2.5s ease-in-out infinite',
                                        overflow: 'hidden',
                                    }}>
                                        {/* Gold corner decorations */}
                                        <div style={{ position: 'absolute', top: 8, left: 8, width: 20, height: 20, borderTop: '2px solid #d4af37', borderLeft: '2px solid #d4af37', borderRadius: '4px 0 0 0' }} />
                                        <div style={{ position: 'absolute', top: 8, right: 8, width: 20, height: 20, borderTop: '2px solid #d4af37', borderRight: '2px solid #d4af37', borderRadius: '0 4px 0 0' }} />
                                        <div style={{ position: 'absolute', bottom: 8, left: 8, width: 20, height: 20, borderBottom: '2px solid #d4af37', borderLeft: '2px solid #d4af37', borderRadius: '0 0 0 4px' }} />
                                        <div style={{ position: 'absolute', bottom: 8, right: 8, width: 20, height: 20, borderBottom: '2px solid #d4af37', borderRight: '2px solid #d4af37', borderRadius: '0 0 4px 0' }} />

                                        {/* Pack-front Crown emblem */}
                                        <Crown size={56} color="#d4af37" strokeWidth={1.5} style={{ filter: 'drop-shadow(0 0 12px rgba(212,175,55,0.6))' }} />
                                        <div style={{ color: '#d4af37', fontSize: 16, fontWeight: 900, marginTop: 16, letterSpacing: '0.05em', textShadow: '0 0 12px rgba(212,175,55,0.5)' }}>MYTHOLOGICAL</div>
                                        <div style={{ color: 'rgba(212,175,55,0.5)', fontSize: 10, fontWeight: 700, marginTop: 6, letterSpacing: '0.15em', textTransform: 'uppercase' }}>Season One</div>
                                    </div>
                                    <p style={{ color: '#d4af37', fontSize: 15, fontWeight: 700, marginTop: 32, animation: 'packPulseText 1.5s ease-in-out infinite', letterSpacing: '0.1em' }}>
                                        TAP TO OPEN
                                    </p>
                                </div>
                            )}

                            {/* STATE: Opening — golden burst */}
                            {revealPhase === 'opening' && (
                                <div style={{
                                    width: 170, height: 240, borderRadius: 20,
                                    background: 'linear-gradient(160deg, #1a1147, #2d1b69)',
                                    border: '2px solid #d4af37',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    animation: 'packBurst 1.2s ease-in-out forwards',
                                }}>
                                    <div style={{
                                        width: 80, height: 80, borderRadius: '50%',
                                        background: 'radial-gradient(circle, #fbbf24, #d4af37)',
                                        animation: 'packFlash 1.2s ease-in-out forwards',
                                    }} />
                                </div>
                            )}

                            {/* STATE: Show result — single skin revealed */}
                            {revealPhase === 'showResult' && (() => {
                                const item = pendingResults.items[currentOpenIndex];
                                const skinData = SKIN_BY_ID[item.id];
                                const tierColor = TIER_COLORS[item.tier] || TIER_COLORS.Uncommon;
                                const isNew = !pendingResults.previousOwned.has(item.id);
                                const iconPath = SKIN_ICONS[item.id];
                                return (
                                    <div onClick={handleNextPack} style={{ cursor: 'pointer', textAlign: 'center', animation: 'packRevealCard 0.6s cubic-bezier(0.34,1.56,0.64,1)' }}>
                                        <div style={{
                                            width: 200, borderRadius: 24, overflow: 'hidden',
                                            background: skinData?.bg || tierColor.bg,
                                            boxShadow: `0 0 60px ${tierColor.glow}80, 0 0 120px ${tierColor.glow}30`,
                                            border: `3px solid ${tierColor.glow}`,
                                        }}>
                                            {isNew && (
                                                <div style={{
                                                    background: '#22c55e', color: 'white', fontSize: 12, fontWeight: 900,
                                                    padding: '6px 0', textAlign: 'center', letterSpacing: '0.1em',
                                                }}>NEW SKIN!</div>
                                            )}
                                            {!isNew && (
                                                <div style={{
                                                    background: 'rgba(0,0,0,0.4)', color: 'rgba(255,255,255,0.7)',
                                                    fontSize: 12, fontWeight: 700, padding: '6px 0', textAlign: 'center',
                                                }}>DUPLICATE</div>
                                            )}
                                            <div style={{ padding: '32px 16px 24px' }}>
                                                <div style={{
                                                    width: 80, height: 80, margin: '0 auto 16px', borderRadius: 20,
                                                    background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                }}>
                                                    {iconPath ? (
                                                        <svg viewBox="0 0 24 24" width={44} height={44} fill="none" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.4))' }}>
                                                            <path d={iconPath} />
                                                        </svg>
                                                    ) : (
                                                        <span style={{ color: 'white', fontSize: 32, fontWeight: 900 }}>{(skinData?.name || '?')[0]}</span>
                                                    )}
                                                </div>
                                                <div style={{ color: 'white', fontSize: 22, fontWeight: 900, marginBottom: 8, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>
                                                    {skinData?.name || item.id}
                                                </div>
                                                <div style={{
                                                    display: 'inline-block', fontSize: 12, fontWeight: 800,
                                                    padding: '4px 16px', borderRadius: 10,
                                                    background: 'rgba(0,0,0,0.3)', color: 'white',
                                                    letterSpacing: '0.08em', textTransform: 'uppercase',
                                                }}>
                                                    {item.tier}
                                                </div>
                                            </div>
                                        </div>
                                        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: 600, marginTop: 24 }}>
                                            {currentOpenIndex + 1 < pendingResults.items.length ? 'Tap for next pack' : 'Tap to see summary'}
                                        </p>
                                    </div>
                                );
                            })()}
                        </div>
                    )}


                </>
                );
            })()}

            {/* ── COLLECTION TAB ────────────────────────────────────────── */}
            {tab === 'collection' && (
                <>
                    {/* Equipped hero */}
                    {(() => {
                        const es = SKIN_BY_ID[equipped.avatar_skin];
                        return (
                            <div style={{
                                borderRadius: 20, padding: '22px 28px', marginBottom: 28, color: 'white',
                                background: es ? es.bg : 'linear-gradient(135deg,#ef4444,#f97316)',
                                boxShadow: es ? `0 8px 28px ${es.glow}50` : undefined,
                                display: 'flex', alignItems: 'center', gap: 20
                            }}>
                                <div style={{
                                    width: 72, height: 72, borderRadius: 16, fontSize: 36,
                                    background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)',
                                    border: '2px solid rgba(255,255,255,0.3)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}>
                                    {/* gradient only, no emoji */}
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.7, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Equipped</div>
                                    <div style={{ fontSize: 26, fontWeight: 900 }}>{es?.name || 'Default'}</div>
                                    <div style={{ fontSize: 12, opacity: 0.75, marginTop: 2 }}>{es ? `${es.tier} Tier` : 'Free'}</div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* Owned */}
                    {loadingOwned ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 16 }}>
                            {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ height: 200, background: '#f3f4f6', borderRadius: 18 }} />)}
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl font-black text-gray-900 mb-4">
                                Owned ({ownedSkins.length})
                            </h2>
                            {ownedSkins.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '32px 0', color: '#9ca3af', marginBottom: 32 }}>
                                    <p style={{ fontWeight: 700 }}>You don't own any skins yet. Head to the Shop!</p>
                                </div>
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 16, marginBottom: 40 }}>
                                    {ownedSkins.map(skin => (
                                        <SkinCard key={skin.id} skin={skin}
                                            isOwned={true} isEquipped={equipped.avatar_skin === skin.id}
                                            canAfford={false} isBuying={false}
                                            onEquip={handleEquip} onBuy={null}
                                            ownedCount={ownedCounts[skin.id] || (skin.cost === 0 ? 1 : 0)}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* Limited Edition */}
                            {ownedSeasonalSkins.length > 0 && (
                                <>
                                    <h2 className="text-xl font-black text-gray-900 mb-4 flex items-center gap-2">
                                        Limited Edition
                                        <span style={{ fontSize: 11, fontWeight: 800, background: '#7c3aed', color: 'white', padding: '2px 10px', borderRadius: 8 }}>SEASON 1</span>
                                    </h2>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 16, marginBottom: 40 }}>
                                        {ownedSeasonalSkins.map(skin => (
                                            <SkinCard key={skin.id} skin={skin}
                                                isOwned={true} isEquipped={equipped.avatar_skin === skin.id}
                                                canAfford={false} isBuying={false}
                                                onEquip={handleEquip} onBuy={null}
                                                ownedCount={ownedCounts[skin.id] || 0}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}

                        </>
                    )}
                </>
            )}
        </div>
    );
}
