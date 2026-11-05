import { useState } from 'react';
import { Copy, Check, Wifi, ShieldCheck, Play, LogOut, Send, Users } from 'lucide-react';
import { CHARACTERS, characterById } from '@/game/data/characters';
import { unlockMet } from '@/game/data/unlocks';
import CharacterPortrait from '@/components/game/CharacterPortrait';
import ArenaThemePicker from '@/components/game/ArenaThemePicker';
import SiteNav from '@/components/game/SiteNav';

export default function CoopStagingRoom({
  roomId,
  coop,
  profile,
  selectedCharId,
  selectedAlt = false,
  onSelectCharacter,
  onLeave
}) {
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [chatText, setChatText] = useState('');

  const inviteUrl = `${window.location.origin}/multiplayer?room=${encodeURIComponent(roomId)}`;
  const me = coop.users.find((u) => u.seat === coop.seat);

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard blocked
    }
  };

  const copyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } catch {
      // Fallback if clipboard blocked
    }
  };

  const submitChat = (e) => {
    e.preventDefault();
    if (!chatText.trim()) return;
    coop.sendChat(chatText);
    setChatText('');
  };

  return (
    <main className="game-grid min-h-screen px-5 pb-12 text-game-ink">
      <SiteNav />
      <div className="mx-auto mt-4 max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border-2 border-game-signal/35 bg-game-panel p-5 sm:p-6">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-300">
                <Wifi className="size-3.5" /> WebSocket Live • Seat #{coop.seat || '…'}
              </span>
              {coop.isHost && (
                <span className="rounded-full bg-game-warm/20 px-3 py-1 text-xs font-bold text-game-warm">
                  Shift Foreman (Host)
                </span>
              )}
              <button
                type="button"
                onClick={copyRoomId}
                title="Click to copy full Room ID"
                className="inline-flex items-center gap-1.5 rounded-full bg-game-bg px-3 py-1 font-mono text-xs text-game-muted hover:text-game-signal"
              >
                <span>Room ID: {roomId}</span>
                {copiedId ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
              </button>
            </div>
            <h1 className="mt-2 font-heading text-2xl font-bold sm:text-3xl">
              {coop.room?.title || 'Field Crew Staging Bay'}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={copyInvite}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-game-signal/40 bg-game-bg px-4 text-sm font-bold text-game-signal hover:bg-game-signal/10"
            >
              {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
              {copied ? 'Invite Link Copied!' : 'Copy Invite Link'}
            </button>
            <button
              type="button"
              onClick={onLeave}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-rose-400/40 bg-game-bg px-4 text-sm font-bold text-rose-300 hover:bg-rose-500/10"
            >
              <LogOut className="size-4" /> Leave Room
            </button>
          </div>
        </header>

        {coop.error && (
          <div
            role="alert"
            className="mt-4 rounded-2xl border border-amber-400/50 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-200"
          >
            {coop.error}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-12">
          <section className="space-y-6 lg:col-span-8">
            <div className="rounded-3xl border border-game-signal/25 bg-game-panel p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-heading text-xl font-bold">
                  <Users className="size-5 text-game-signal" /> Crew Seats ({coop.users.length} / 4)
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => coop.toggleReady(!me?.ready)}
                    className={`min-h-11 rounded-xl px-5 font-bold ${
                      me?.ready
                        ? 'border-2 border-emerald-400 bg-emerald-500/20 text-emerald-200'
                        : 'bg-game-bg text-game-ink border border-game-signal/40'
                    }`}
                  >
                    {me?.ready ? '✓ Ready for Shift' : 'Mark Ready'}
                  </button>
                  {coop.isHost && (
                    <button
                      type="button"
                      onClick={coop.startShift}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-game-warm px-5 font-bold text-game-bg hover:opacity-95"
                    >
                      <Play className="size-4 fill-current" /> Launch Shift
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((slot) => {
                  const occupant = coop.users.find((u) => u.seat === slot);
                  const ch = occupant ? characterById(occupant.characterId) : null;
                  return (
                    <div
                      key={slot}
                      className={`flex items-center gap-3.5 rounded-2xl border p-4 ${
                        occupant
                          ? occupant.seat === coop.seat
                            ? 'border-game-signal bg-game-bg'
                            : 'border-white/15 bg-game-bg/80'
                          : 'border-dashed border-white/10 bg-game-bg/30 opacity-60'
                      }`}
                    >
                      {occupant && ch ? (
                        <>
                          <CharacterPortrait character={ch} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="rounded bg-game-panel px-2 py-0.5 text-xs font-bold text-game-signal">
                                P{occupant.seat}
                              </span>
                              <b className="truncate text-sm">{occupant.name}</b>
                            </div>
                            <p className="mt-0.5 truncate text-xs font-bold text-game-warm">{ch.name}</p>
                            <p className="mt-1 text-xs text-game-muted">{ch.special.name}</p>
                            <span
                              className={`mt-1.5 inline-flex items-center gap-1 text-xs font-bold ${
                                occupant.ready ? 'text-emerald-300' : 'text-amber-200/80'
                              }`}
                            >
                              <ShieldCheck className="size-3.5" />
                              {occupant.ready ? 'Ready' : 'Selecting gear…'}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="py-4 text-sm text-game-muted">
                          Seat #{slot} — Open (Share invite link)
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {coop.isHost ? (
                <ArenaThemePicker
                  value={coop.room?.arenaChoice || 'random'}
                  onChange={coop.setArenaChoice}
                  includeRandom
                />
              ) : (
                <p className="mt-4 text-xs font-bold uppercase tracking-wider text-game-muted">
                  Host Arena Backdrop Choice:{' '}
                  <span className="text-game-signal">{coop.room?.arenaChoice || 'random'}</span> (Resolved:{' '}
                  {coop.room?.arenaTheme || 'office'})
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-game-signal/25 bg-game-panel p-5 sm:p-6">
              <h2 className="font-heading text-xl font-bold">Choose Your Technician</h2>
              <p className="mt-1 text-xs text-game-muted">
                Your selection broadcasts live to the room over WebSockets.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
                {CHARACTERS.map((c) => {
                  const locked = !unlockMet(profile, c);
                  const altUnlocked = Boolean(c.altKit && unlockMet(profile, c.altKit));
                  const active = selectedCharId === c.id;
                  return (
                    <div
                      key={c.id}
                      className={`flex flex-col items-center rounded-2xl border p-3 text-center transition ${
                        active
                          ? 'border-2 border-game-warm bg-game-bg'
                          : locked
                          ? 'cursor-not-allowed border-white/10 bg-game-bg/30 opacity-45'
                          : 'border-white/15 bg-game-bg/70 hover:border-game-signal/60'
                      }`}
                    >
                      <button
                        type="button"
                        disabled={locked}
                        onClick={() => onSelectCharacter(c, active ? selectedAlt : false)}
                        className="flex w-full flex-col items-center"
                      >
                        <CharacterPortrait character={c} />
                        <b className="mt-2 line-clamp-1 text-xs">{c.name}</b>
                        <span className="mt-0.5 text-[11px] text-game-signal">
                          {locked ? 'Locked' : c.special.name}
                        </span>
                      </button>
                      {!locked && altUnlocked && active && (
                        <button
                          type="button"
                          onClick={() => onSelectCharacter(c, !selectedAlt)}
                          className="mt-2 rounded-lg border border-game-signal/40 bg-game-panel px-2 py-1 text-[10px] font-bold text-game-warm"
                        >
                          {selectedAlt ? 'Alt Kit Active' : 'Use Alt Kit'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <aside className="flex flex-col rounded-3xl border border-game-signal/25 bg-game-panel p-5 sm:p-6 lg:col-span-4">
            <h2 className="font-heading text-lg font-bold">Dispatch Comms</h2>
            <p className="text-xs text-game-muted">Live room channel</p>
            <div className="mt-3 flex-1 space-y-2 overflow-y-auto rounded-2xl bg-game-bg p-3 text-xs max-h-80 min-h-56">
              {!coop.chat.length ? (
                <p className="text-game-muted">No messages yet. Coordinate your toolkit picks here.</p>
              ) : (
                coop.chat.map((m) => (
                  <div key={m.id} className="rounded-lg bg-game-panel/80 px-2.5 py-1.5">
                    <span className="font-bold text-game-signal">
                      P{m.seat} {m.name}:{' '}
                    </span>
                    <span className="text-game-ink">{m.text}</span>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={submitChat} className="mt-3 flex gap-2">
              <input
                type="text"
                value={chatText}
                maxLength={200}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Radio the crew…"
                className="min-h-10 flex-1 rounded-xl border border-game-signal/35 bg-game-bg px-3 text-xs text-game-ink"
              />
              <button
                type="submit"
                className="inline-flex min-h-10 items-center justify-center rounded-xl bg-game-signal px-3 font-bold text-game-bg"
              >
                <Send className="size-3.5" />
              </button>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}