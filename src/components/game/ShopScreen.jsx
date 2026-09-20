import { useMemo, useState } from 'react';
import { createGenerator, applyMods, dailySeed, RARITY } from '@/game/data/generation';
import { sfx } from '@/game/audio';
import GameButton from '@/components/game/GameButton';

export default function ShopScreen({ run, onContinue, onChange }) {
  const gen = useMemo(() => createGenerator(run.seed + run.wave * 7919), []);
  const stock = () => [gen.weapon(run.luck), gen.weapon(run.luck), gen.passive(run.luck), gen.passive(run.luck)];
  const [items, setItems] = useState(stock);
  const [rerolls, setRerolls] = useState(0);

  // NEW: when a weapon purchase would need a slot that doesn't exist, we don't
  // block the purchase anymore — we stash it here and show a picker asking
  // which current tool to retire. null = no picker open.
  const [pendingItem, setPendingItem] = useState(null);

  // `blocked(item)` answers: "is there currently no free slot for this weapon?"
  // It only applies to weapons (passives never occupy a tool slot — see item.baseId
  // check below, which is only set on weapons).
  //
  // Two cases can trigger this:
  //  1. You're at your character's total slot cap (run.character.slots || 6).
  //  2. You're the Veteran, whose passive caps melee and ranged tools at 4 each
  //     even if your total slot count (8) isn't full yet.
  //
  // Because SignalSurvival.jsx now normalizes every weapon (starting or bought)
  // into the same object shape with a `slotType` field, this check no longer
  // needs the old `typeof w === 'string' ? ... : ...` branch or the hardcoded
  // melee-name list — every entry in run.weapons reliably has slotType.
  const blocked = item => {
    if (!item.baseId) return false;
    const slots = run.character.slots || 6;
    if (run.weapons.length >= slots) return true;
    if (run.character.id !== 'veteran') return false;
    const family = item.slotType || 'ranged';
    return run.weapons.filter(w => (w.slotType || 'ranged') === family).length >= 4;
  };

  // Given a weapon that's `blocked()`, which of your current tools could you
  // retire to make room for it?
  //  - If you're at the flat total-slot cap, any current tool is a valid target.
  //  - If instead it's the Veteran's family cap that's blocking you, only tools
  //    in that same family (melee/ranged) are valid targets — swapping out a
  //    tool from the *other* family wouldn't fix the family cap and would just
  //    quietly break the intended 4/4 split.
  const eligibleSwapSlots = item => {
    const slots = run.character.slots || 6;
    const atTotalCapacity = run.weapons.length >= slots;
    const withIndex = run.weapons.map((weapon, index) => ({ weapon, index }));
    if (atTotalCapacity) return withIndex;
    const family = item.slotType || 'ranged';
    return withIndex.filter(({ weapon }) => (weapon.slotType || 'ranged') === family);
  };

  // Does the actual purchase: applies the item's stat mods to the run, deducts
  // Signal, and either appends the weapon (there's room) or swaps it into the
  // chosen slot (replaceIndex is set, from the picker below).
  const commitPurchase = (item, replaceIndex = null) => {
    let next = applyMods(run, item);
    next = { ...next, signal: run.signal - item.cost, items: [...(run.items || []), item] };
    if (item.baseId) {
      next.weapons = replaceIndex == null
        ? [...run.weapons, item]                                       // normal case: had an open slot
        : run.weapons.map((w, i) => (i === replaceIndex ? item : w));  // swap case: replace that slot in place
    }
    onChange(next);
    setItems(v => v.filter(x => x !== item));
    setPendingItem(null);
    sfx('purchase');
  };

  const buy = item => {
    if (run.signal < item.cost) return; // can't afford it either way
    if (item.baseId && blocked(item)) {
      // No free slot for this weapon — ask which tool to retire instead of
      // silently doing nothing (which is what happened before this change).
      setPendingItem(item);
      return;
    }
    commitPurchase(item);
  };

  const reroll = () => {
    const cost = 4 + rerolls * 2;
    if (run.signal < cost) return;
    onChange({ ...run, signal: run.signal - cost });
    setItems(stock());
    setRerolls(v => v + 1);
    sfx('reroll');
  };

  return (
    <main className="van-shop min-h-screen p-5 text-white sm:p-9">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-black uppercase tracking-[.3em] text-amber-300">Company Van • Seed {run.seed || dailySeed()}</p>
            <h1 className="text-4xl font-black uppercase sm:text-5xl">Between-Wave Shop</h1>
          </div>
          <div className="rounded-xl bg-cyan-300 px-5 py-3 text-xl font-black text-slate-950">Signal: {run.signal}</div>
        </header>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(i => {
            const needsSwap = i.baseId && blocked(i); // affordable-but-full-loadout weapon
            return (
              <article key={i.id} className="flex min-h-72 flex-col rounded-2xl border-2 bg-slate-900/95 p-5" style={{ borderColor: RARITY[i.rarity].color }}>
                <span className="text-4xl">{i.icon}</span>
                <div className="mt-3 text-xs font-black uppercase" style={{ color: RARITY[i.rarity].color }}>{i.rarity}</div>
                <h2 className="mt-1 text-lg font-black leading-tight">{i.name}</h2>
                <p className="mt-2 flex-1 text-sm font-semibold leading-relaxed text-slate-300">{i.desc}{i.special ? ` • ${i.special}` : ''}</p>
                <button
                  disabled={run.signal < i.cost}
                  onClick={() => buy(i)}
                  className="mt-4 min-h-11 cursor-pointer rounded-lg bg-amber-300 px-3 font-black text-slate-950 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {/* CHANGED: previously this button just went disabled/greyed when your
                      loadout was full, with no way forward. Now it stays clickable and
                      relabels itself so a full loadout reads as "you can still get this,
                      you'll just have to swap" rather than a dead end. */}
                  {needsSwap ? 'Swap for' : 'Buy'} • {i.cost}
                </button>
              </article>
            );
          })}
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-4">
          <GameButton tone="dark" onClick={reroll} disabled={run.signal < 4 + rerolls * 2}>Reroll • {4 + rerolls * 2}</GameButton>
          <GameButton onClick={onContinue}>Start Wave {run.wave + 1}</GameButton>
        </div>
      </div>

      {/* NEW: the swap picker. Only rendered while pendingItem is set (i.e. the
          player clicked "Swap for" on a weapon they have no free slot for).
          Fixed positioning means it doesn't matter that it's nested inside
          <main> rather than a sibling — it covers the viewport regardless. */}
      {pendingItem && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-5">
          <div className="w-full max-w-lg rounded-2xl border-2 border-amber-300 bg-slate-900 p-6">
            <p className="text-xs font-black uppercase tracking-[.3em] text-amber-300">No open tool slot</p>
            <h2 className="mt-1 text-2xl font-black">Retire a tool for {pendingItem.name}?</h2>
            <p className="mt-2 text-sm font-semibold text-slate-300">{pendingItem.desc}</p>

            <div className="mt-4 space-y-2">
              {eligibleSwapSlots(pendingItem).map(({ weapon, index }) => (
                <button
                  key={index}
                  onClick={() => commitPurchase(pendingItem, index)}
                  className="flex w-full items-center gap-3 rounded-xl border-2 border-white/15 bg-slate-800 p-3 text-left hover:border-amber-300 hover:bg-slate-700"
                >
                  <span className="text-2xl">{weapon.icon}</span>
                  <span className="flex-1">
                    <span className="block font-black">{weapon.name}</span>
                    <span className="block text-xs text-slate-400">{weapon.damage} dmg • {weapon.rate}s cooldown</span>
                  </span>
                </button>
              ))}
            </div>

            <GameButton tone="dark" className="mt-5 w-full" onClick={() => setPendingItem(null)}>Never mind</GameButton>
          </div>
        </div>
      )}
    </main>
  );
}
