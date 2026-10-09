import OraclePortrait from '@/components/game/OraclePortrait';
import DonPortrait from '@/components/game/DonPortrait';
import VeteranPortrait from '@/components/game/VeteranPortrait';
import ClonePortrait from '@/components/game/ClonePortrait';
import NomadPortrait from '@/components/game/NomadPortrait';
export default function CharacterPortrait({ character:c }) {
  if(c.id==='oracle')return <OraclePortrait name={c.name}/>;
  if(c.id==='don')return <DonPortrait name={c.name}/>;
  if(c.id==='veteran')return <VeteranPortrait name={c.name}/>;
  if(c.id==='clone')return <ClonePortrait name={c.name}/>;
  if(c.id==='nomad')return <NomadPortrait name={c.name}/>;
  return <svg viewBox="0 0 100 100" className="size-20 shrink-0" role="img" aria-label={`${c.name} portrait`}><rect x="3" y="3" width="94" height="94" rx="25" fill={c.belt}/><circle cx="50" cy="41" r="24" fill={c.color}/><path d="M23 65Q50 52 77 65V94H23Z" fill={c.vest}/><path d="M36 62V89M64 62V89" stroke="#fff5c2" strokeWidth="5"/><path d="M23 26Q50 -1 77 26Z" fill={c.color}/><rect x="17" y="25" width="66" height="7" rx="3" fill={c.color}/><circle cx="40" cy="42" r="7" fill="#fff"/><circle cx="60" cy="42" r="7" fill="#fff"/><circle cx="42" cy="43" r="3" fill="#152936"/><circle cx="62" cy="43" r="3" fill="#152936"/>{['oracle','admin'].includes(c.id)&&<path d="M30 40H48V49H30ZM52 40H70V49H52ZM48 43H52" fill="none" stroke={c.belt} strokeWidth="3"/>}{c.id==='patty'&&<rect x="61" y="68" width="20" height="26" rx="3" fill="#f8fafc"/>}{c.id==='deadline'&&<path d="M74 68L87 82L74 92" fill="none" stroke="#f8fafc" strokeWidth="4"/>}</svg>;
}