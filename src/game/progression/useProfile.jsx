import { useEffect, useSyncExternalStore } from 'react';
import { bindProfile, unbindProfile, subscribeSave, getSaveState } from '@/game/storage';
import { refreshAudio } from '@/game/audio';
export default function useProfile(ownerId) {
  const state=useSyncExternalStore(subscribeSave,getSaveState,getSaveState);
  useEffect(()=>{if(!ownerId)return;void bindProfile(ownerId).then(refreshAudio);return()=>unbindProfile(ownerId)},[ownerId]);
  return state;
}