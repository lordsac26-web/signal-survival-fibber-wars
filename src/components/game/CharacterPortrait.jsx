import OraclePortrait from '@/components/game/OraclePortrait';
import DonPortrait from '@/components/game/DonPortrait';
import VeteranPortrait from '@/components/game/VeteranPortrait';
import ClonePortrait from '@/components/game/ClonePortrait';
import NomadPortrait from '@/components/game/NomadPortrait';
import ISRPortrait from '@/components/game/ISRPortrait';
import AdminPortrait from '@/components/game/AdminPortrait';
export default function CharacterPortrait({ character:c }) {
  if(c.id==='isr')return <ISRPortrait name={c.name}/>;
  if(c.id==='oracle')return <OraclePortrait name={c.name}/>;
  if(c.id==='don')return <DonPortrait name={c.name}/>;
  if(c.id==='veteran')return <VeteranPortrait name={c.name}/>;
  if(c.id==='clone')return <ClonePortrait name={c.name}/>;
  if(c.id==='nomad')return <NomadPortrait name={c.name}/>;
  if(c.id==='admin')return <AdminPortrait name={c.name}/>;
  return null;
}