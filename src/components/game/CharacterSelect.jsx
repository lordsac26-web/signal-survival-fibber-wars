import { useState } from 'react';
import { CHARACTERS } from '@/game/data/characters';
import { unlockMet } from '@/game/data/unlocks';
import CharacterCard from '@/components/game/CharacterCard';
import ArenaThemePicker from '@/components/game/ArenaThemePicker';
export default function CharacterSelect({save,onBack,onSelect}) {
  const [theme,setTheme]=useState('classic');
  return <main className="game-grid min-h-screen p-5 text-game-ink sm:p-10"><div className="mx-auto max-w-6xl"><button onClick={onBack} className="mb-5 min-h-11 font-bold text-game-signal">← Back to profile</button><h1 className="font-heading text-3xl font-bold uppercase sm:text-4xl">Who clocked in?</h1><p className="mt-2 text-game-muted">{CHARACTERS.length} technicians on the roster: {CHARACTERS.filter(c=>!c.unlock).length} clock in at will, and {CHARACTERS.filter(c=>c.unlock).length} earn their desks through career milestones. Character choice stays fixed for the run; your starting tools are rolled and picked at clock-in.</p><ArenaThemePicker value={theme} onChange={setTheme}/><div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{CHARACTERS.map(c=><CharacterCard key={c.id} character={c} locked={!unlockMet(save,c)} unlockDesc={c.unlock?.desc} selected={save.selectedCharacter===c.id} onSelect={(c)=>onSelect(c,false,theme)}/>)}</div></div></main>;
}