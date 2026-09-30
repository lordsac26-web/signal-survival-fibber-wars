import { useState } from 'react';
import { CHARACTERS } from '@/game/data/characters';
import CharacterCard from '@/components/game/CharacterCard';
export default function CharacterSelect({save,onBack,onSelect}) {
  const [alt,setAlt]=useState(save.selectedLoadouts || {});
  return <main className="game-grid min-h-screen p-5 text-game-ink sm:p-10"><div className="mx-auto max-w-6xl"><button onClick={onBack} className="mb-5 min-h-11 font-bold text-game-signal">← Back to profile</button><h1 className="font-heading text-4xl font-bold uppercase">Who clocked in?</h1><p className="mt-2 text-game-muted">All eleven technicians are available immediately. Character choice stays fixed for the run; alternate kits remain career rewards.</p><div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{CHARACTERS.map(c=><CharacterCard key={c.id} character={c} selected={save.selectedCharacter===c.id} altOk={(save.loadouts || []).includes(`${c.id}:alt`)} useAlt={!!alt[c.id] && (save.loadouts || []).includes(`${c.id}:alt`)} onAlt={value=>setAlt({...alt,[c.id]:value})} onSelect={onSelect}/>)}</div></div></main>;
}