// Mobile/touch place button for deployable structures. Mirrors SpecialButton:
// shows the currently selected deployable, a cooldown ring, and fires the
// engine's `deploy` input flag on press. Desktop users press Q.
export default function DeployButton({ hud, input }) {
  const dep = hud.deploy;
  if (!dep?.items?.length) return null;
  const sel = dep.items.find(d => d.selected) || dep.items[0];
  const pct = sel.cdMax ? sel.cd / sel.cdMax : 0;
  return (
    <button
      onPointerDown={() => { input.current.deploy = true; }}
      disabled={sel.cd > 0}
      title={`${sel.name} — place (Q), switch (C)`}
      className="absolute bottom-40 left-5 z-20 flex size-20 cursor-pointer flex-col items-center justify-center rounded-full border-4 border-amber-100 bg-slate-900 text-center font-black uppercase text-amber-200 shadow-[0_6px_0_#b45309] disabled:cursor-not-allowed disabled:border-slate-600 disabled:bg-slate-800 disabled:text-slate-500 md:bottom-6 md:left-6 md:size-24"
    >
      <span className="text-2xl leading-none">{sel.icon}</span>
      {sel.cd > 0
        ? <span className="text-sm tabular-nums">{Math.ceil(sel.cd)}</span>
        : <span className="text-[10px]">Q</span>}
      {sel.cd > 0 && (
        <span
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{ background: `conic-gradient(rgba(2,6,23,.75) ${pct * 360}deg, transparent 0deg)` }}
        />
      )}
    </button>
  );
}