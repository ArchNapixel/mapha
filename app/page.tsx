import PhilippinesMap from "@/components/map/philippines-map";

const steps = ["Visit a real spot", "Tap “Mark as visited”", "Earn a stamp and fill the map"];

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-sea font-sans">
      <h1 className="sr-only">MaPHo: collect the Philippines, one stamp at a time</h1>

      <PhilippinesMap
        intro={
          <>
            <p className="text-sm font-semibold uppercase tracking-wider text-accent">Now open in Davao</p>
            <p className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-5xl">
              Collect the Philippines, one stamp at a time.
            </p>
            <p className="text-muted lg:text-lg">
              Explore places in your own city and beyond. Every spot you visit earns a stamp in your digital
              passport and lights up the map.
            </p>
            <ol className="hidden gap-2 text-sm sm:flex sm:flex-col">
              {steps.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className="grid size-6 place-items-center rounded-full bg-accent/15 text-xs font-bold text-accent">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </>
        }
      />

      <span className="pointer-events-none absolute left-4 top-4 text-xl font-bold tracking-tight lg:left-12">
        Ma<span className="text-accent">PH</span>o
      </span>

      <p className="absolute inset-x-4 bottom-2 text-[10px] text-muted sm:text-xs lg:left-12">
        Boundaries: NAMRIA and PSA via OCHA (COD-AB), CC BY-IGO, prepared by faeldon/philippines-json-maps
        (PSGC 2026-3Q).
      </p>
    </main>
  );
}
