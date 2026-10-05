import { CHARACTERS } from '@/game/data/characters';
import { WEAPONS } from '@/game/data/combat';

// Career badges, never character gates. Legacy ids remain stable for migration.
// progress(save) powers career displays; checks run only on unique run completion.
export const CHALLENGES = [
  { id: 'veteran', name: 'Ten-Wave Service Badge', desc: 'Survive to Wave 10 with any technician', goal: 10, progress: s => Math.min(s.highWave || 0, 10), check: (s, r) => r.wave >= 10 },
  { id: 'oracle', name: '250-Repair Trace Badge', desc: 'Terminate 250 impairments in a single run', goal: 250, progress: s => Math.min(s.highKills || 0, 250), check: (s, r) => (r.kills || 0) >= 250 },
  { id: 'frenzy', name: 'Triple-Splice Badge', desc: 'Own 3 melee tools at once', goal: 3, progress: s => Math.min(s.meleePeak || 0, 3), check: (s, r) => (r.meleePeak || 0) >= 3 || (r.weapons || []).filter(w => w.slotType === 'melee').length >= 3 },
  { id: 'cleaner', name: 'Clean Recovery Badge', desc: 'Recover 300 HP in a single run', goal: 300, progress: s => Math.min(s.healPeak || 0, 300), check: (s, r) => (r.healed || 0) >= 300 },
  { id: 'nomad', name: 'No-Purchase Night Badge', desc: 'Reach Wave 8 without buying anything', goal: 8, progress: s => Math.min(s.noBuyWave || 0, 8), check: (s, r) => r.wave >= 8 && !(r.buys > 0) },
  { id: 'bucket', name: 'Elevated Service Badge', desc: 'Survive 15 waves', goal: 15, progress: s => Math.min(s.highWave || 0, 15), check: (s, r) => r.wave >= 15 },
  { id: 'dispatch', name: 'Please Hold Badge', desc: 'Get truck-rolled 10 times — a proud participation trophy', goal: 10, progress: s => Math.min(s.deaths || 0, 10), check: s => (s.deaths || 0) >= 10 }
];

// Career achievements, checked against the lifetime save
export const ACHIEVEMENTS = [
  { id: 'apprentice', name: 'Apprentice', desc: 'Complete 100 career repairs', goal: 100, progress: s => Math.min(s.totalKills || 0, 100), check: s => (s.totalKills || 0) >= 100 },
  { id: 'journeyman', name: 'Journeyman', desc: 'Complete 1,000 career repairs', goal: 1000, progress: s => Math.min(s.totalKills || 0, 1000), check: s => (s.totalKills || 0) >= 1000 },
  { id: 'signal-baron', name: 'Signal Baron', desc: 'Collect 1,000 Signal in a single run', goal: 1000, progress: s => Math.min(s.bestSignal || 0, 1000), check: s => (s.bestSignal || 0) >= 1000 },
  { id: 'full-rack', name: 'Full Rack', desc: 'Carry 6 tools at once', goal: 6, progress: s => Math.min(s.toolPeak || 0, 6), check: s => (s.toolPeak || 0) >= 6 },
  { id: 'company-man', name: 'Company Man', desc: 'Complete 25 shifts', goal: 25, progress: s => Math.min(s.runs || 0, 25), check: s => (s.runs || 0) >= 25 },
  { id: 'double-digits', name: 'Double Digits', desc: 'Survive to Wave 10', goal: 10, progress: s => Math.min(s.highWave || 0, 10), check: s => (s.highWave || 0) >= 10 },
  { id: 'truck-rolled', name: 'Truck Rolled', desc: 'Get truck-rolled 10 times', goal: 10, progress: s => Math.min(s.deaths || 0, 10), check: s => (s.deaths || 0) >= 10 }
];

// Alternate starting toolkits, one per character (altStart/altUnlock live in
// characters.js so the balance numbers stay with the character data).
// Character gating (new): a technician with an `unlock` spec stays locked
// until the lifetime metric meets the goal. 'squirrel' reads the
// squirrelDefeated career flag (set when a run clears a boss wave); other
// metrics are plain profile counters. Reads metrics only — never the unlocked
// list — so migrated saves cannot accidentally pre-unlock gated technicians.
export const unlockMet = (p, c) => !c.unlock ||
  (c.unlock.metric === 'squirrel' ? !!p.squirrelDefeated : (p[c.unlock.metric] || 0) >= c.unlock.goal);

export const LOADOUTS = CHARACTERS.filter(c => c.altStart).map(c => ({
  id: `${c.id}:alt`,
  charId: c.id,
  charName: c.name,
  tools: c.altStart.map(id => WEAPONS[id]?.name || id).join(' + '),
  desc: c.altUnlock.desc,
  goal: c.altUnlock.goal,
  progress: s => Math.min(s[c.altUnlock.metric] || 0, c.altUnlock.goal),
  check: s => (s[c.altUnlock.metric] || 0) >= c.altUnlock.goal
}));