import { base44 } from '@/api/base44Client';
import { CHALLENGES, ACHIEVEMENTS, LOADOUTS } from '@/game/data/unlocks';

// THE save manager: every persistent read/write goes through this module
// (progress, unlocks, challenges, achievements, per-type kill logs, settings)
// so future features like daily challenges hook in here instead of adding
// new storage keys. Same localStorage key as v1 so existing careers survive.
const KEY = 'signal-survival-save-v1';
const SETTINGS_KEY = 'signal-survival-audio-v1';
const FRESH = {
  version: 3, highWave: 0, highKills: 0, runs: 0, totalKills: 0, deaths: 0, bestSignal: 0,
  healPeak: 0, meleePeak: 0, toolPeak: 0, noBuyWave: 0,
  highWaveByCharacter: {}, killsByType: {},
  unlocked: ['rookie'], achievements: [], loadouts: [], updatedAt: 0
};

export function loadSave() {
  try {
    const old = JSON.parse(localStorage.getItem(KEY)) || {};
    const save = {
      ...FRESH, ...old,
      unlocked: Array.isArray(old.unlocked) ? old.unlocked : ['rookie'],
      achievements: Array.isArray(old.achievements) ? old.achievements : [],
      loadouts: Array.isArray(old.loadouts) ? old.loadouts : [],
      highWaveByCharacter: old.highWaveByCharacter || {},
      killsByType: old.killsByType || {}
    };
    if (!save.unlocked.includes('rookie')) save.unlocked.unshift('rookie');
    return save;
  } catch { return { ...FRESH }; }
}

function persist(save) {
  save.updatedAt = Date.now();
  localStorage.setItem(KEY, JSON.stringify(save));
}

// Called once per completed run (on death). Merges the run into the career
// save, evaluates every challenge/achievement/loadout unlock, and returns the
// new save plus a list of this run's NEW unlocks for the summary screen.
export function recordRun(run) {
  const save = loadSave();
  const next = { ...save,
    runs: (save.runs || 0) + 1,
    totalKills: (save.totalKills || 0) + (run.kills || 0),
    deaths: (save.deaths || 0) + (run.hp <= 0 ? 1 : 0),
    highWave: Math.max(save.highWave || 0, run.wave || 0),
    highKills: Math.max(save.highKills || 0, run.kills || 0),
    bestSignal: Math.max(save.bestSignal || 0, run.signal || 0),
    healPeak: Math.max(save.healPeak || 0, run.healed || 0),
    meleePeak: Math.max(save.meleePeak || 0, run.meleePeak || 0, (run.weapons || []).filter(w => w.slotType === 'melee').length),
    toolPeak: Math.max(save.toolPeak || 0, run.toolPeak || 0, (run.weapons || []).length),
    noBuyWave: (run.buys || 0) === 0 ? Math.max(save.noBuyWave || 0, run.wave || 0) : (save.noBuyWave || 0),
    highWaveByCharacter: { ...save.highWaveByCharacter, [run.character.id]: Math.max(save.highWaveByCharacter?.[run.character.id] || 0, run.wave || 0) },
    killsByType: { ...save.killsByType }
  };
  for (const [kind, n] of Object.entries(run.killsByType || {})) next.killsByType[kind] = (next.killsByType[kind] || 0) + n;

  const newUnlocks = [];
  next.unlocked = [...save.unlocked];
  for (const ch of CHALLENGES) if (!next.unlocked.includes(ch.id) && ch.check(next, run)) { next.unlocked.push(ch.id); newUnlocks.push({ type: 'technician', label: ch.name }); }
  next.achievements = [...save.achievements];
  for (const a of ACHIEVEMENTS) if (!next.achievements.includes(a.id) && a.check(next)) { next.achievements.push(a.id); newUnlocks.push({ type: 'achievement', label: a.name }); }
  next.loadouts = [...save.loadouts];
  for (const l of LOADOUTS) if (!next.loadouts.includes(l.id) && l.check(next)) { next.loadouts.push(l.id); newUnlocks.push({ type: 'toolkit', label: `${l.charName} — ${l.tools}` }); }

  persist(next);
  syncCloud(next);
  return { save: next, newUnlocks };
}

// ---- optional cross-device sync via the SaveSync entity (owner-only RLS) ----
// Fully best-effort: localStorage remains the source of truth; if the player
// isn't signed in (or is offline) these calls silently no-op.
let syncing = false;
export async function syncCloud(save) {
  if (syncing) return;
  syncing = true;
  try {
    const list = await base44.entities.SaveSync.list('-updated_date', 5);
    if (list && list.length) await base44.entities.SaveSync.update(list[0].id, { data: save });
    else await base44.entities.SaveSync.create({ data: save });
  } catch { /* not signed in / offline — local save still valid */ }
  syncing = false;
}

export async function pullCloud() {
  try {
    const list = await base44.entities.SaveSync.list('-updated_date', 5);
    const rec = list && list[0];
    const local = loadSave();
    if (rec?.data && (rec.data.updatedAt || 0) > (local.updatedAt || 0)) { persist(rec.data); return rec.data; }
  } catch { /* ignore */ }
  return null;
}

// ---- settings (audio.js persists through here so it's all one save manager) ----
export function loadSettings() {
  try { return { muted: false, volume: .55, ...JSON.parse(localStorage.getItem(SETTINGS_KEY)) }; }
  catch { return { muted: false, volume: .55 }; }
}
export function saveSettings(next) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}