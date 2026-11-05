import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Radio, Lock, Users, ArrowRight, RefreshCw, PlusCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import SiteNav from '@/components/game/SiteNav';
import ArenaThemePicker from '@/components/game/ArenaThemePicker';

export default function CoopRoomBrowser({
  user,
  arenaChoice,
  onArenaChange,
  onCreatePublic,
  onCreatePrivate,
  onJoinRoom
}) {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [roomInput, setRoomInput] = useState('');
  const [shiftTitle, setShiftTitle] = useState(`${user?.full_name || 'Dispatch'}'s Crew Shift`);
  const [creating, setCreating] = useState(false);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const page = await base44.entities.CoopLobby.filter(
        { status: { $in: ['lobby', 'loadout', 'combat', 'intermission'] } },
        { sort: '-updated_date', limit: 20 }
      );
      const list = Array.isArray(page) ? page : page?.items || [];
      const cutoff = Date.now() - 1000 * 60 * 45;
      setRooms(
        list.filter((r) => {
          const t = r.updated_date ? new Date(r.updated_date).getTime() : Date.now();
          return r.status !== 'closed' && (r.player_count || 0) > 0 && t >= cutoff;
        })
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const unsub = base44.entities.CoopLobby.subscribe((ev) => {
      if (!ev) return;
      if (ev.type === 'delete' || ev.data?.status === 'closed' || (ev.data?.player_count || 0) <= 0) {
        setRooms((prev) => prev.filter((r) => r.id !== ev.id));
      } else if (ev.type === 'create' || ev.type === 'update') {
        setRooms((prev) => {
          const rest = prev.filter((r) => r.id !== ev.id);
          return [{ id: ev.id, ...ev.data }, ...rest].slice(0, 20);
        });
      }
    });
    void loadRooms();
    return () => unsub?.();
  }, []);

  const handleJoinSubmit = (e) => {
    e.preventDefault();
    const raw = roomInput.trim();
    if (!raw) return;
    try {
      const url = new URL(raw);
      const param = url.searchParams.get('room');
      if (param) {
        onJoinRoom(param);
        return;
      }
    } catch {
      // Plain room code
    }
    onJoinRoom(raw);
  };

  const handlePublicCreate = async () => {
    setCreating(true);
    try {
      await onCreatePublic(shiftTitle.trim() || 'Field Crew Shift');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="game-grid min-h-screen px-5 pb-12 text-game-ink">
      <SiteNav />
      <div className="mx-auto mt-4 grid max-w-6xl gap-6 lg:grid-cols-12">
        <section className="rounded-3xl border-2 border-game-signal/30 bg-game-panel p-6 sm:p-8 lg:col-span-5">
          <div className="inline-flex items-center gap-2 rounded-full bg-game-signal/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-game-signal">
            <Radio className="size-3.5" /> WebSocket Co-Op Dispatch
          </div>
          <h1 className="mt-3 font-heading text-3xl font-bold">Roll a multi-truck shift.</h1>
          <p className="mt-2 text-sm leading-relaxed text-game-muted">
            Host an authoritative WebSocket room for up to 4 technicians. Share a private invite link or list your shift on the open dispatch board.
          </p>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-bold text-game-signal">Shift callsign</span>
            <input
              type="text"
              value={shiftTitle}
              maxLength={44}
              onChange={(e) => setShiftTitle(e.target.value)}
              className="min-h-11 w-full rounded-xl border border-game-signal/40 bg-game-bg px-3.5 text-sm text-game-ink focus:outline focus:outline-2 focus:outline-game-signal"
              placeholder="e.g. Night Fiber Splice Crew"
            />
          </label>

          <ArenaThemePicker value={arenaChoice} onChange={onArenaChange} includeRandom />

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={creating}
              onClick={handlePublicCreate}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-game-signal px-4 font-bold text-game-bg hover:opacity-95 disabled:opacity-50"
            >
              <PlusCircle className="size-4 shrink-0" />
              {creating ? 'Opening…' : 'Create public room'}
            </button>
            <button
              type="button"
              disabled={creating}
              onClick={() => onCreatePrivate(shiftTitle.trim() || 'Private Crew Shift')}
              className="flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 border-game-warm/60 bg-game-bg px-4 font-bold text-game-warm hover:bg-game-warm/10 disabled:opacity-50"
            >
              <Lock className="size-4 shrink-0" />
              Create private room
            </button>
          </div>

          <form onSubmit={handleJoinSubmit} className="mt-6 border-t border-white/10 pt-5">
            <label htmlFor="join-code-input" className="mb-2 block text-sm font-bold text-game-ink">
              Join by Room ID or Invite URL
            </label>
            <div className="flex gap-2">
              <input
                id="join-code-input"
                type="text"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                placeholder="Paste room code or invite link…"
                className="min-h-11 flex-1 rounded-xl border border-game-signal/35 bg-game-bg px-3.5 text-sm text-game-ink placeholder:text-game-muted"
              />
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-game-warm px-4 font-bold text-game-bg"
              >
                Join <ArrowRight className="size-4" />
              </button>
            </div>
          </form>

          <Link
            to="/player"
            className="mt-6 flex min-h-11 items-center justify-center rounded-xl border border-game-signal/25 bg-game-bg/60 text-sm font-bold text-game-muted hover:text-game-ink"
          >
            ← Return to Solo Break Room
          </Link>
        </section>

        <section className="rounded-3xl border-2 border-game-warm/30 bg-game-panel p-6 sm:p-8 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-game-warm">Live Registry</p>
              <h2 className="mt-1 font-heading text-2xl font-bold">Open Dispatch Rooms</h2>
            </div>
            <button
              type="button"
              onClick={loadRooms}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-game-signal/30 bg-game-bg px-3 text-xs font-bold text-game-signal"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
          </div>

          <div className="mt-5 grid gap-3">
            {loading && !rooms.length ? (
              <div className="rounded-2xl border border-white/10 bg-game-bg/60 p-6 text-center text-sm text-game-muted">
                Scanning active WebSocket shift rooms…
              </div>
            ) : !rooms.length ? (
              <div className="rounded-2xl border border-white/10 bg-game-bg/60 p-8 text-center">
                <Users className="mx-auto size-8 text-game-signal/60" />
                <p className="mt-3 font-bold text-game-ink">No public shift rooms open right now.</p>
                <p className="mt-1 text-sm text-game-muted">
                  Create a public room on the left to list your crew here, or spin up a private room and share the invite link.
                </p>
              </div>
            ) : (
              rooms.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-game-signal/25 bg-game-bg/80 p-4"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="inline-block size-2.5 rounded-full bg-emerald-400" />
                      <h3 className="font-heading text-lg font-bold">{r.title || 'Field Crew Shift'}</h3>
                      <span className="rounded-md bg-game-panel px-2 py-0.5 text-xs font-bold uppercase text-game-signal">
                        {r.status || 'lobby'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-game-muted">
                      Host: <b className="text-game-ink">{r.host_name || 'Technician'}</b> • Wave {r.wave || 1} • Backdrop:{' '}
                      {r.arena_choice || 'random'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-lg border border-white/10 bg-game-panel px-3 py-1.5 text-xs font-bold tabular-nums">
                      {r.player_count || 1} / {r.max_players || 4} Techs
                    </span>
                    <button
                      type="button"
                      onClick={() => onJoinRoom(r.id)}
                      className="min-h-10 rounded-xl bg-game-signal px-4 text-sm font-bold text-game-bg hover:opacity-95"
                    >
                      Join Shift
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}