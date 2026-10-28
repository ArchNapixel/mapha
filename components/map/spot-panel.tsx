"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronDown, Stamp, X } from "lucide-react";
import { SPOTS, type Category, type Spot } from "@/lib/spots";
import { CATEGORY } from "./categories";

const CATEGORIES = [...new Set(SPOTS.map((s) => s.category))] as Category[];

// Phone bottom-sheet stops, as a share of the screen height. Desktop shows a fixed side panel instead.
const SNAP = { peek: 0.18, half: 0.45, full: 0.88 } as const;
type Snap = keyof typeof SNAP;

// Unvisited: an outlined "Mark as visited". Visited: a tilted passport stamp; tap again to undo.
function MarkButton({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={done}
      title={done ? "Stamped. Tap to undo" : undefined}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold transition-transform ${
        done
          ? "-rotate-6 border-2 border-stamp font-display uppercase tracking-wider text-stamp"
          : "border border-foreground/20 hover:bg-foreground/5"
      }`}
    >
      {done ? (
        <span className="flex items-center gap-1">
          <Stamp size={12} strokeWidth={2.5} /> Stamped
        </span>
      ) : (
        "Mark as visited"
      )}
    </button>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div
      role="progressbar"
      aria-label="Davao City completion"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      className="relative size-16 shrink-0"
    >
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-foreground/10" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="stroke-accent transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-sm font-bold">
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}

export function SpotPanel({
  visited,
  pct,
  selected,
  onSelect,
  onToggle,
}: {
  visited: Set<string>;
  pct: number;
  selected: string | null;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [snap, setSnap] = useState<Snap>("half");
  const [dragPx, setDragPx] = useState<number | null>(null);
  const drag = useRef<{ startY: number; startPx: number; moved: boolean } | null>(null);
  const justDragged = useRef(false); // a drag ends with a click; don't treat it as a tap
  const done = SPOTS.filter((s) => visited.has(s.id)).length;

  // Keep the spot picked on the map in view in the list.
  useEffect(() => {
    if (selected) document.getElementById(`spot-${selected}`)?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startY: e.clientY, startPx: SNAP[snap] * innerHeight, moved: false };
  }
  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dy = d.startY - e.clientY;
    if (Math.abs(dy) > 5) d.moved = true;
    if (d.moved) setDragPx(Math.min(Math.max(d.startPx + dy, SNAP.peek * innerHeight), SNAP.full * innerHeight));
  }
  function onPointerUp() {
    const d = drag.current;
    drag.current = null;
    justDragged.current = !!d?.moved;
    if (!d?.moved || dragPx === null) return;
    // Snap to the nearest stop.
    const share = dragPx / innerHeight;
    setSnap((Object.keys(SNAP) as Snap[]).reduce((a, b) => (Math.abs(SNAP[b] - share) < Math.abs(SNAP[a] - share) ? b : a)));
    setDragPx(null);
  }
  // Tap or keyboard on the handle steps through the stops.
  function onHandleClick() {
    if (justDragged.current) {
      justDragged.current = false;
      return;
    }
    setSnap((s) => (s === "peek" ? "half" : s === "half" ? "full" : "peek"));
  }

  return (
    <aside
      aria-label="Davao City spots"
      style={{ "--sheet-h": dragPx === null ? `${SNAP[snap] * 100}dvh` : `${dragPx}px` } as React.CSSProperties}
      className={`absolute inset-x-0 bottom-0 z-10 flex h-[var(--sheet-h)] flex-col rounded-t-2xl bg-surface shadow-xl motion-safe:transition-[height] sm:inset-x-auto sm:bottom-10 sm:right-4 sm:top-16 sm:h-auto sm:w-[30rem] sm:rounded-2xl ${
        dragPx !== null ? "duration-0" : "duration-200"
      }`}
    >
      <button
        aria-label={`Resize spot list (now ${snap})`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onHandleClick}
        className="flex w-full touch-none justify-center pb-1 pt-2 sm:hidden"
      >
        <span className="h-1.5 w-10 rounded-full bg-foreground/20" />
      </button>
      <header className="flex items-center gap-4 border-b border-foreground/10 px-4 pb-4 sm:pt-4">
        <ProgressRing pct={pct} />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">Your passport</p>
          <h2 className="font-display text-xl font-bold leading-tight">Davao City</h2>
          <p className="text-sm text-muted">
            {done} of {SPOTS.length} spots stamped
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-2">
        {CATEGORIES.map((cat) => {
          const { color, Icon } = CATEGORY[cat];
          const spots = SPOTS.filter((s) => s.category === cat);
          const catDone = spots.filter((s) => visited.has(s.id)).length;
          return (
            <details key={cat} open className="group mb-1">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-2 py-2 hover:bg-foreground/5 [&::-webkit-details-marker]:hidden">
                <span className="grid size-7 place-items-center rounded-full text-white" style={{ background: color }}>
                  <Icon size={14} strokeWidth={2.5} />
                </span>
                <span className="flex-1 font-display text-sm font-semibold">{cat}</span>
                <span className="text-xs font-semibold text-muted">
                  {catDone}/{spots.length}
                </span>
                <ChevronDown size={16} className="text-muted transition-transform group-open:rotate-180" />
              </summary>
              <ul className="pb-1">
                {spots.map((s) => (
                  <li
                    key={s.id}
                    id={`spot-${s.id}`}
                    className={`flex items-center gap-2 rounded-lg py-1.5 pl-11 pr-2 ${s.id === selected ? "bg-accent/10" : ""}`}
                  >
                    <button onClick={() => onSelect(s.id)} className="flex-1 text-left text-sm">
                      {s.name}
                    </button>
                    <MarkButton done={visited.has(s.id)} onClick={() => onToggle(s.id)} />
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </aside>
  );
}

// Card for the spot picked on the map or in the list. Shows the spot's photo when it has one,
// otherwise its category art.
export function SpotCard({
  spot,
  done,
  onToggle,
  onClose,
}: {
  spot: Spot;
  done: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const { color, Icon } = CATEGORY[spot.category];
  return (
    <div className="absolute inset-x-4 bottom-4 z-20 overflow-hidden rounded-2xl bg-surface shadow-xl sm:inset-x-auto sm:bottom-10 sm:left-4 sm:w-80">
      <div
        className="relative h-16 sm:h-32"
        style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
      >
        {spot.photo ? (
          <Image src={spot.photo} alt={spot.name} fill sizes="320px" className="object-cover" />
        ) : (
          <Icon aria-hidden className="absolute -bottom-6 -right-4 size-32 text-white/25" strokeWidth={1.5} />
        )}
        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-semibold" style={{ color }}>
          <Icon size={12} strokeWidth={2.5} /> {spot.category}
        </span>
        <button
          onClick={onClose}
          aria-label="Close spot card"
          className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-white/90 text-foreground hover:bg-white"
        >
          <X size={16} />
        </button>
      </div>
      <div className="p-4">
        <p className="font-display text-lg font-bold leading-tight">{spot.name}</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-sm text-muted">{done ? "In your passport" : "Not stamped yet"}</p>
          <MarkButton done={done} onClick={onToggle} />
        </div>
      </div>
    </div>
  );
}

// Fixed at module load so renders stay pure; positions only need to look random.
const CONFETTI = Array.from({ length: 60 }, (_, i) => ({
  left: (i * 37) % 100,
  delay: ((i * 53) % 60) / 100,
  drift: ((i * 29) % 40) - 20,
  color: ["#f08c00", "#c92a2a", "#2b8a3e", "#0038a8", "#fcd116"][i % 5],
}));

// Stamp that thumps onto the screen after a mark, and confetti when the city hits 100%.
// The parent clears both after they play; keys restart the animation on each new one.
export function Celebration({
  stamp: showStamp,
  celebrate: showConfetti,
}: {
  stamp: { key: number; name: string } | null;
  celebrate: number;
}) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden" aria-live="polite">
      {showStamp && (
        <div key={showStamp.key} className="absolute inset-0 grid place-items-center">
          <div className="stamp grid size-44 place-items-center rounded-full border-[6px] border-double border-stamp bg-surface/90 p-5 text-center text-stamp shadow-xl">
            <div className="font-display">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em]">Stamped</p>
              <p className="my-1 text-base font-extrabold leading-tight">{showStamp.name}</p>
              <p className="text-[10px] font-bold uppercase tracking-[0.25em]">Davao City · PH</p>
            </div>
          </div>
        </div>
      )}
      {showConfetti > 0 && (
        <div key={showConfetti} className="motion-reduce:hidden">
          <p className="sr-only">Davao City complete!</p>
          {CONFETTI.map((c, i) => (
            <span
              key={i}
              className="confetti absolute -top-4 h-3 w-2 rounded-sm"
              style={
                {
                  left: `${c.left}%`,
                  background: c.color,
                  animationDelay: `${c.delay}s`,
                  "--drift": `${c.drift}vw`,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
