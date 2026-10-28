"use client";

import dynamic from "next/dynamic";

// three.js needs the browser, so the map never renders on the server.
const MapScene = dynamic(() => import("./map-scene"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-muted">Loading map…</div>,
});

export default function PhilippinesMap({ intro }: { intro?: React.ReactNode }) {
  return <MapScene intro={intro} />;
}
