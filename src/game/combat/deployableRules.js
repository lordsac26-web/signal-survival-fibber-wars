// Field Engineer deployable rules: concurrent caps and stat inheritance for
// deployed sentries/structures. ONE canonical module so the engine, tests and
// the HUD all read the same numbers.
import { TUNING } from '@/game/data/tuning';

const isEngineer = run => run.character?.id === 'engineer';

// (b) Concurrent deployable caps: 2 placed structures per player by default.
// The Field Engineer is the deployables specialist: 12 placed structures
// (4 deployable items x 3 instances) when his whole 4-slot kit is deployables.
export const structureCap = run => isEngineer(run) ? TUNING.engineerStructureCap : TUNING.structureCap;

// (c) Per deployable ITEM instance cap: 3 for the Field Engineer, 2 for
// everyone else — the "2-at-once default" adopted across the roster.
export const structureItemCap = run => isEngineer(run) ? TUNING.engineerDeployInstanceCap : TUNING.structureCap;

// Per weapon-turret instance cap (auto-deployed sentries), same ladder.
export const turretInstanceCap = run => isEngineer(run) ? TUNING.engineerDeployInstanceCap : TUNING.deployInstanceCap;

// Placement exclusion radius: a deployable cannot be placed overlapping/near
// an existing friendly deployable.
export const PLACE_PROXIMITY = TUNING.placeProximity;

// The Field Engineer re-arms his gear fast: his deployable placement cooldown
// runs at this fraction, so a structure can outlive its own cooldown and the
// per-item 3-instance cap is actually reachable.
export const ENGINEER_DEPLOY_CD_MULT = .6;

// (c) Field Engineer stat inheritance: HIS deployed units inherit his damage
// multiplier and attack-speed (range already flows through effectiveRange,
// lifesteal already flows through the shared hit() pipeline for every
// deployable; tier bonuses arrive via the weapon's scaled damage). Other
// technicians keep the pre-existing tuning exactly.
export function turretStats(run, weapon, cfg) {
  const damage = weapon.damage * (1 + (run.engineering || 0) * .01) * (1 + (run.turretQuality || 0) * .004);
  const inherit = isEngineer(run);
  return {
    damage: inherit ? damage * (run.damage || 1) : damage,
    fire: inherit ? cfg.fire / Math.max(.2, run.attackSpeed || 1) : cfg.fire
  };
}

export function structureTurretStats(run, def, power) {
  const damage = def.damage * (1 + .2 * (power - 1)) * (1 + (run.engineering || 0) * .01);
  const inherit = isEngineer(run);
  return {
    damage: inherit ? damage * (run.damage || 1) : damage,
    fire: inherit ? def.fire / Math.max(.2, run.attackSpeed || 1) : def.fire
  };
}