// DEPLOYABLE STRUCTURES — the Q-key item system + structure stats.
// All balance numbers live here for the tuning pass.

// Structures placed in the world by deployable items.
export const STRUCTURES = {
  turretMount: { name: 'Turret Mount',        icon: '🔩', color: '#f59e0b', kind: 'turret', r: 16, life: 12, cd: 14, damage: 9,  fire: .45, range: 300 },
  barricade:   { name: 'Traffic Barricade',    icon: '🚧', color: '#fb923c', kind: 'block',  r: 24, life: 20, cd: 9 },
  ratTrap:     { name: 'Rat Guard',            icon: '🪤', color: '#f87171', kind: 'trap',   r: 18, life: 24, cd: 11, chomp: 26, uses: 4 },
  snare:       { name: 'Slack Coil Snare',     icon: '🌀', color: '#22d3ee', kind: 'slow',   r: 80, life: 12, cd: 12, slow: .45 },
  pedestal:    { name: 'Portable Pedestal',   icon: '🗿', color: '#facc15', kind: 'buff',   r: 85, life: 15, cd: 13, buff: .25 }
};

// Shop items that grant placement abilities. First purchase unlocks the
// ability; each extra copy improves it: −12% cooldown and +20% potency per
// extra copy, applied to at most DEPLOY_STACK_BONUS extra copies.
export const DEPLOYABLES = [
  { id: 'bucket_keys', name: 'Bucket Truck Keys',     icon: '🔑', structure: 'turretMount', cost: 22, desc: 'Press Q to plant a hard-hatted Turret Mount right where you\'re standing.' },
  { id: 'cone_kit',    name: 'Traffic Barricade Kit', icon: '🚧', structure: 'barricade',   cost: 18, desc: 'Places a striped barricade. Impairments must politely go around.' },
  { id: 'rat_guard',   name: 'Rat Guard',             icon: '🪤', structure: 'ratTrap',     cost: 16, desc: 'A spring-loaded grievance. Chomps the first few impairments to step on it.' },
  { id: 'slack_coil',  name: 'Slack Coil Snare',     icon: '🌀', structure: 'snare',        cost: 18, desc: 'Deploys excess slack. Impairments inside move like they\'re on hold with Dispatch.' },
  { id: 'pedestal',    name: 'Portable Pedestal',    icon: '🗿', structure: 'pedestal',     cost: 20, desc: 'Stand near it for bonus Attack Speed. It believes in you.' }
];

export const STRUCTURE_CAP_BASE = 6;   // total placed structures allowed; +1 per 10 Engineering
export const DEPLOY_STACK_BONUS = 3;  // max extra copies that improve a deployable