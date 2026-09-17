const KEY = 'signal-survival-save-v1';
const fresh = { highWave: 0, highKills: 0, runs: 0, unlocked: ['rookie'] };

export function loadSave() {
  try { return { ...fresh, ...JSON.parse(localStorage.getItem(KEY)) }; }
  catch { return fresh; }
}

export function recordRun(run) {
  const save = loadSave();
  const next = {
    ...save,
    runs: save.runs + 1,
    highWave: Math.max(save.highWave, run.wave),
    highKills: Math.max(save.highKills, run.kills),
    unlocked: run.wave >= 3 ? [...new Set([...save.unlocked, 'nomad'])] : save.unlocked
  };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}