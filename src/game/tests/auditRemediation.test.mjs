import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CHARACTERS, characterById } from '@/game/data/characters';
import { createRun, advanceRunWave } from '@/game/progression/runRules';
import { startingOffers, startingPickCount, applyStartingKit } from '@/game/progression/startingKit';
import { freshProfile } from '@/game/progression/profileModel';
import { guideEntries } from '@/game/data/reference';
import { validateProfile } from 'profileValidation';

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8');

test('Field Guide entries contain no uninterpolated template placeholders', () => {
  const sections = guideEntries();
  for (const [section, entries] of Object.entries(sections)) {
    for (const entry of entries) {
      assert(!String(entry.title || '').includes('${'), `${section}:${entry.id} title has uninterpolated template`);
      assert(!String(entry.body || '').includes('${'), `${section}:${entry.id} body has uninterpolated template`);
      assert(!String(entry.detail || '').includes('${'), `${section}:${entry.id} detail has uninterpolated template`);
    }
  }
});

test('validateProfile computes milestone unlocked list and rejects out-of-bounds weapon/mod/counter values', () => {
  const base = freshProfile();
  const validatedFresh = validateProfile(base, 'user-1');
  assert.equal(validatedFresh.unlocked.length, 6);
  assert(!validatedFresh.unlocked.includes('clone'));
  assert(!validatedFresh.unlocked.includes('isr'));

  const unlockedBoth = validateProfile({ ...base, deaths: 5, squirrelDefeated: true }, 'user-1');
  assert(unlockedBoth.unlocked.includes('clone'));
  assert(unlockedBoth.unlocked.includes('isr'));

  const run = createRun(characterById('nomad'), false, 42, 'audit-run');
  assert.throws(
    () =>
      validateProfile(
        {
          ...base,
          checkpoint: {
            phase: 'ready',
            run: { ...run, weapons: [{ ...run.weapons[0], damage: 999999 }] }
          }
        },
        'user-1'
      ),
    /Forbidden or malformed weapon/
  );

  assert.throws(
    () =>
      validateProfile(
        {
          ...base,
          checkpoint: {
            phase: 'ready',
            run: { ...run, items: [{ id: 'hack', mods: [{ stat: 'damage', value: 99999 }] }] }
          }
        },
        'user-1'
      ),
    /Malformed passive modifiers/
  );

  assert.throws(
    () =>
      validateProfile(
        {
          ...base,
          checkpoint: {
            phase: 'ready',
            run: { ...run, signal: 1e12 }
          }
        },
        'user-1'
      ),
    /Invalid signal/
  );
});

test('Alternate starting toolkits (useAlt) surface in startingOffers and equip via applyStartingKit', () => {
  for (const c of CHARACTERS.filter((ch) => ch.altStart)) {
    const { offers } = startingOffers(c, 12345, undefined, true);
    for (const altId of c.altStart) {
      assert(
        offers.some((o) => o.baseId === altId),
        `${c.id} altStart tool ${altId} must appear in alternate startingOffers`
      );
    }
    const need = startingPickCount(c);
    const run = { ...createRun(c, true, 12345, `alt-${c.id}`), useAlt: true };
    const equipped = applyStartingKit(
      run,
      offers.slice(0, need).map((o) => o.id)
    );
    assert.equal(equipped.weapons.length, need);
    assert.equal(equipped.weapons[0].baseId, c.altStart[0]);
  }
});

test('advanceRunWave resets deployable placement cooldowns between waves', () => {
  const run = { ...createRun(characterById('engineer'), false, 99, 'cd-reset'), deployCds: { turretMount: 14, barricade: 9 } };
  const next = advanceRunWave(run);
  assert.equal(next.wave, 2);
  assert.deepEqual(next.deployCds, {});
});

test('GalleryScreen, Home, MenuScreen, Login, Register, Audio, and CoopRoom include audit remediations', () => {
  const gallery = read('components/game/GalleryScreen.jsx');
  assert(!gallery.includes('const done = true;'), 'GalleryScreen no longer hardcodes done = true');
  assert(gallery.includes('unlockMet(save, c)'), 'GalleryScreen checks unlockMet(save, c)');

  const home = read('pages/Home.jsx');
  assert(home.includes('Eight characters. One van.'), 'Home copy matches 8-character roster');

  const menu = read('components/game/MenuScreen.jsx');
  assert(menu.includes('characterById(id)?.name || id'), 'MenuScreen resolves technician display names');

  const login = read('pages/Login.jsx');
  assert(login.includes('loginWithMfa') && login.includes('continueMfa') && login.includes('loginWithGoogle'), 'Login uses MFA helpers');

  const register = read('pages/Register.jsx');
  assert(register.includes('continueMfa') && register.includes('loginWithGoogle'), 'Register uses MFA helpers');

  const audio = read('game/audio.js');
  assert(!audio.includes('export function sfx(name){settings=loadSettings()'), 'sfx() uses cached settings instead of per-call localStorage read');

  const actor = readFileSync(new URL('../../../base44/actors/CoopRoom/entry.ts', import.meta.url), 'utf8');
  assert(actor.includes('/^[a-f0-9]{24}$/i.test(msg.registryId)'), 'CoopRoom validates registryId format');
  assert(actor.includes("kind === 'heal_pulse' && u.characterId !== 'nomad'"), 'CoopRoom restricts heal_pulse to nomad');
});