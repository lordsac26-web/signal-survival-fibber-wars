export const CHARACTERS = [
  { id: 'rookie', name: 'Rookie Splicer', tag: 'Balanced & eager', color: '#facc15', vest: '#f97316', start: ['cleaver'], blurb: 'Fresh out of training. Still reads the safety manual.', stats: { maxHp: 100, speed: 250, damage: 1, attackSpeed: 1, armor: 0, range: 1, crit: .05, regen: 1 }, passive: '+10% Signal pickup range' },
  { id: 'nomad', name: 'Night-Shift Nomad', tag: 'Fast & fortunate', color: '#60a5fa', vest: '#a855f7', start: ['vfl'], blurb: 'Powered by vending-machine coffee and suspicious confidence.', stats: { maxHp: 82, speed: 300, damage: .92, attackSpeed: 1.12, armor: 0, range: 1.12, crit: .08, regen: .5 }, passive: '+20% speed, +15 luck', unlock: 'Survive Wave 3' }
];

export const WEAPONS = {
  cleaver: { name: 'Fiber Cleaver', icon: '✂', color: '#fde047', damage: 24, rate: .7, range: 92, type: 'slash', desc: 'A crisp arc. No glass shards, probably.' },
  vfl: { name: 'Visual Fault Locator', icon: '↗', color: '#ef4444', damage: 9, rate: .28, range: 390, type: 'shot', desc: 'Points directly at the problem. Aggressively.' },
  otdr: { name: 'OTDR', icon: '⌁', color: '#22d3ee', damage: 34, rate: 1.25, range: 520, type: 'pierce', desc: 'Launches a very judgmental test pulse.' },
  splicer: { name: 'Fusion Splicer', icon: '⚡', color: '#c084fc', damage: 31, rate: .92, range: 120, type: 'nova', desc: 'Fuses fibers, enemies, and workplace expectations.' },
  stripper: { name: 'Fiber Stripper', icon: '≋', color: '#fb923c', damage: 8, rate: .18, range: 145, type: 'shot', desc: 'Rapidly removes jackets and dignity.' },
  cleaner: { name: 'One-Click Cleaner', icon: '◉', color: '#34d399', damage: 15, rate: .72, range: 155, type: 'nova', heal: 2, desc: 'Clean connector, clean conscience, tiny heal.' },
  cutters: { name: 'Kevlar Cutters', icon: '✕', color: '#f472b6', damage: 42, rate: 1.05, range: 105, type: 'slash', crit: .2, desc: 'Snip first. Fill out the ticket later.' },
  jumper: { name: 'Patch Cord Whip', icon: '∿', color: '#a3e635', damage: 18, rate: .55, range: 210, type: 'shot', desc: 'The bend radius guideline is merely a suggestion.' },
  power: { name: 'Optical Power Meter', icon: '▣', color: '#38bdf8', damage: 22, rate: .8, range: 330, type: 'shot', desc: 'Reads −40 dBm: enemy morale critically low.' }
};

export const ENEMIES = {
  lag: { name: 'Lag Sprite', color: '#fbbf24', hp: 20, speed: 64, damage: 8, r: 13, value: 2, eyes: 2 },
  packet: { name: 'Packet-Loss Pudding', color: '#fb7185', hp: 36, speed: 44, damage: 10, r: 18, value: 3, eyes: 2 },
  jitter: { name: 'Jitter Bug', color: '#a3e635', hp: 26, speed: 92, damage: 7, r: 12, value: 3, eyes: 3 },
  dirty: { name: 'Dirty-Connector Blob', color: '#a78bfa', hp: 55, speed: 52, damage: 12, r: 21, value: 5, eyes: 1 },
  bend: { name: 'Macrobend Beast', color: '#f97316', hp: 88, speed: 58, damage: 17, r: 25, value: 8, eyes: 2 },
  crosstalk: { name: 'Crosstalk Critter', color: '#2dd4bf', hp: 42, speed: 72, damage: 10, r: 15, value: 5, eyes: 4 },
  attenuation: { name: 'Attenuation Apparition', color: '#94a3b8', hp: 120, speed: 46, damage: 20, r: 28, value: 12, eyes: 2 }
};

export const UPGRADES = [
  { id: 'splice', name: 'Textbook Splice', icon: '⚡', desc: '+15% damage', apply: r => ({ ...r, damage: r.damage * 1.15 }) },
  { id: 'coffee', name: 'Night-Shift Coffee', icon: '▰', desc: '+12% attack speed', apply: r => ({ ...r, attackSpeed: r.attackSpeed * 1.12 }) },
  { id: 'jacket', name: 'Extra Jacket Protection', icon: '◆', desc: '+2 armor', apply: r => ({ ...r, armor: r.armor + 2 }) },
  { id: 'boots', name: 'Connector Boots', icon: '⌁', desc: '+9% movement speed', apply: r => ({ ...r, speed: r.speed * 1.09 }) },
  { id: 'tube', name: 'Gel-Filled Buffer Tube', icon: '●', desc: '+16 max HP and heal 16', apply: r => ({ ...r, maxHp: r.maxHp + 16, hp: Math.min(r.maxHp + 16, r.hp + 16) }) },
  { id: 'wipe', name: 'Industrial Cleaning Wipe', icon: '✦', desc: '+2 HP regen', apply: r => ({ ...r, regen: r.regen + 2 }) },
  { id: 'launch', name: 'OTDR Launch Cable', icon: '↗', desc: '+18% range', apply: r => ({ ...r, range: r.range * 1.18 }) },
  { id: 'cap', name: 'Premium Dust Cap', icon: '⬟', desc: '+8% critical chance', apply: r => ({ ...r, crit: r.crit + .08 }) }
];

export const SHOP_ITEMS = [
  { id: 'hardhat', name: 'Overbuilt Hard Hat', icon: '◒', cost: 18, desc: '+12 max HP', apply: r => ({ ...r, maxHp:r.maxHp+12, hp:r.hp+12 }) },
  { id: 'shrinks', name: 'Heat Shrink Bundle', icon: '▥', cost: 16, desc: '+1 armor', apply: r => ({ ...r, armor:r.armor+1 }) },
  { id: 'wipes', name: 'Suspiciously Damp Wipes', icon: '✦', cost: 15, desc: '+1.5 HP regen', apply: r => ({ ...r, regen:r.regen+1.5 }) },
  { id: 'vest', name: 'Hi-Vis Battle Vest', icon: '◇', cost: 20, desc: '+10% damage', apply: r => ({ ...r, damage:r.damage*1.1 }) }
];

export const pick = (list, count) => [...list].sort(() => Math.random() - .5).slice(0, count);