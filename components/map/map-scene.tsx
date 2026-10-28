"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, Html } from "@react-three/drei";
import { geoMercator, type GeoProjection } from "d3-geo";
import * as THREE from "three";
import { Stamp } from "lucide-react";
import { DAVAO_CITY_PSGC, SPOTS, type Spot } from "@/lib/spots";
import { completion, loadVisited, saveVisited } from "@/lib/visited";
import { CATEGORY } from "./categories";
import { Celebration, SpotCard, SpotPanel } from "./spot-panel";

type Props = { psgc: number; name: string; level: string };
type Geo = { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
type Feature = { type: "Feature"; properties: Props; geometry: Geo };
type Collection = { type: "FeatureCollection"; features: Feature[] };
type View = "country" | "davao" | "city";

// Only Davao Region has city-level detail in the MVP, and only Davao City has spots.
const PILOT_REGION = 1100000000;
const PILOT_CITY = DAVAO_CITY_PSGC;

const COLOR = {
  stone: "#e3ddd0", // regions not open yet
  stoneHover: "#f0ebe1",
  pilot: "#f08c00", // the open pilot region
  pilotHover: "#ffa94d",
  sand: "#f1e4c6", // neighbors of the place you're looking at
  sandHover: "#f8efdc",
  cityFrom: "#f6b26b", // Davao City at 0% ...
  cityTo: "#c92a2a", // ... and at 100% (stamp red)
  outline: "#ffffff",
};

// Landing view zoom. Lower = closer. 1 fits the whole bounding sphere with room to spare.
const FIT_ZOOM = 0.7;

// Spots closer than this many pixels on screen merge into one numbered bubble.
const CLUSTER_PX = 44;

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Shadows cost GPU time; skip them on phones and low-core devices.
const canShadow = () =>
  !window.matchMedia("(max-width: 639px)").matches && (navigator.hardwareConcurrency ?? 8) > 4;

const setCursor = (c: string) => (document.body.style.cursor = c);

// GeoJSON ring -> THREE.Shape. y is negated because d3 grows y downward.
function toShapes(geometry: Geo, project: GeoProjection): THREE.Shape[] {
  const polygons = (geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates) as number[][][][];
  const ring = (coords: number[][]) =>
    coords.slice(0, -1).map(([lon, lat]) => {
      const [x, y] = project([lon, lat])!;
      return new THREE.Vector2(x, -y);
    });
  return polygons.map(([outer, ...holes]) => {
    const shape = new THREE.Shape(ring(outer));
    shape.holes = holes.map((h) => new THREE.Path(ring(h)));
    return shape;
  });
}

// Border lines along the top edge only, so walls don't get striped.
function topOutline(shapes: THREE.Shape[], z: number) {
  const pts: number[] = [];
  for (const shape of shapes) {
    for (const ring of [shape.getPoints(), ...shape.holes.map((h) => h.getPoints())]) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        pts.push(a.x, a.y, z, b.x, b.y, z);
      }
    }
  }
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
}

function Area({
  feature,
  project,
  color,
  hoverColor,
  height,
  lift = 0.05,
  onHover,
  onSelect,
}: {
  feature: Feature;
  project: GeoProjection;
  color: string;
  hoverColor: string;
  height: number;
  lift?: number;
  onHover: (f: Feature | null) => void;
  onSelect: (f: Feature) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const { geometry, outline } = useMemo(() => {
    const shapes = toShapes(feature.geometry, project);
    return {
      geometry: new THREE.ExtrudeGeometry(shapes, { depth: height, bevelEnabled: false }),
      outline: topOutline(shapes, height + 0.0005),
    };
  }, [feature, project, height]);
  useEffect(
    () => () => {
      geometry.dispose();
      outline.dispose();
    },
    [geometry, outline],
  );

  return (
    <group position-z={hovered ? lift : 0}>
      <mesh
        geometry={geometry}
        castShadow
        receiveShadow
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          setCursor("pointer");
          onHover(feature);
        }}
        onPointerOut={() => {
          setHovered(false);
          setCursor("auto");
          onHover(null);
        }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (e.delta > 4) return; // was a drag, not a tap
          onSelect(feature);
        }}
      >
        <meshStandardMaterial color={hovered ? hoverColor : color} roughness={0.85} />
      </mesh>
      <lineSegments geometry={outline}>
        <lineBasicMaterial color={COLOR.outline} transparent opacity={0.75} />
      </lineSegments>
    </group>
  );
}

// Sun that follows whatever the camera framed, so shadows stay sharp at every zoom level.
function Sun({ sphere, shadows }: { sphere: THREE.Sphere | null; shadows: boolean }) {
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useRef<THREE.Object3D>(null);
  useEffect(() => {
    const l = light.current;
    if (!sphere || !l || !target.current) return;
    const r = sphere.radius;
    target.current.position.copy(sphere.center);
    l.target = target.current;
    l.position.copy(sphere.center).add(new THREE.Vector3(0.45, 1, 0.65).normalize().multiplyScalar(r * 3));
    const cam = l.shadow.camera;
    cam.left = cam.bottom = -r * 1.3;
    cam.right = cam.top = r * 1.3;
    cam.near = r * 0.5;
    cam.far = r * 6;
    cam.updateProjectionMatrix();
    l.shadow.normalBias = r * 0.003;
  }, [sphere]);
  return (
    <>
      <object3D ref={target} />
      <directionalLight
        ref={light}
        color="#fff6e5"
        intensity={2.2}
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
      />
    </>
  );
}

// Frames the camera on its children whenever it becomes active. Lives inside the Canvas so its
// effect runs after its meshes exist (the Canvas mounts its tree separately).
// isHome: fit instantly and save it as the "Reset view" target.
// clearSheet: on phones, frame it in the top half so the spot sheet doesn't cover it.
// onFit: gets the framed area, used to aim the sun.
function FitCamera({
  controls,
  active = true,
  isHome = false,
  clearSheet = false,
  onFit,
  children,
}: {
  controls: React.RefObject<CameraControls | null>;
  active?: boolean;
  isHome?: boolean;
  clearSheet?: boolean;
  onFit: (s: THREE.Sphere) => void;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  const fitRef = useRef(onFit);
  useEffect(() => {
    fitRef.current = onFit;
  });
  useEffect(() => {
    const c = controls.current;
    if (!active || !c || !group.current) return;
    group.current.updateWorldMatrix(true, true); // not rendered yet, so world matrix is stale
    const sphere = new THREE.Box3().setFromObject(group.current).getBoundingSphere(new THREE.Sphere());
    fitRef.current(sphere.clone());
    if (isHome) {
      sphere.radius *= FIT_ZOOM; // a box's sphere has empty corners; shrink it so the map fills the screen
      sphere.center.z += sphere.radius * 0.12; // tilt makes the south (+z, nearer the camera) look bigger; aim a bit south
    }
    const phone = window.matchMedia("(max-width: 639px)").matches;
    if (clearSheet) sphere.radius *= phone ? 1.15 : 1.1;
    c.fitToSphere(sphere, !isHome && !reducedMotion()).then(() => isHome && c.saveState());
    // fitToSphere zeroes the focal offset, so this must come after it.
    // Phones: lift it above the bottom sheet. Desktop: slide it left of the side panel.
    if (clearSheet) c.setFocalOffset(phone ? 0 : sphere.radius * 0.45, phone ? sphere.radius * 0.55 : 0, 0, !reducedMotion());
  }, [controls, active, isHome, clearSheet]);
  return <group ref={group}>{children}</group>;
}

type Point = { spot: Spot; x: number; y: number };

// Spot markers in map space. Nearby spots merge into a numbered bubble; tapping it zooms in.
function Markers({
  project,
  base,
  visited,
  selected,
  controls,
  onSelect,
}: {
  project: GeoProjection;
  base: number;
  visited: Set<string>;
  selected: string | null;
  controls: React.RefObject<CameraControls | null>;
  onSelect: (id: string) => void;
}) {
  const { camera, size } = useThree();
  const [cell, setCell] = useState(0.02);

  // Map units per CLUSTER_PX at the current zoom, rounded so we only re-cluster on real zoom changes.
  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    const fov = THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov);
    const next = +(((2 * c.distance * Math.tan(fov / 2)) / size.height) * CLUSTER_PX).toPrecision(2);
    if (next !== cell) setCell(next);
  });

  const points = useMemo<Point[]>(
    () =>
      SPOTS.map((spot) => {
        const [x, y] = project([spot.lon, spot.lat])!;
        return { spot, x, y };
      }),
    [project],
  );

  // ponytail: greedy O(n²) grouping; fine for a city's worth of spots, use a grid index past a few hundred.
  const clusters = useMemo(() => {
    const out: { x: number; y: number; members: Point[] }[] = [];
    for (const p of points) {
      const c = out.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < cell);
      if (!c) {
        out.push({ x: p.x, y: p.y, members: [p] });
        continue;
      }
      c.members.push(p);
      c.x = c.members.reduce((s, m) => s + m.x, 0) / c.members.length;
      c.y = c.members.reduce((s, m) => s + m.y, 0) / c.members.length;
    }
    return out;
  }, [points, cell]);

  function zoomTo(c: (typeof clusters)[number]) {
    const r = Math.max(0.01, ...c.members.map((m) => Math.hypot(m.x - c.x, m.y - c.y))) * 1.8;
    // Map space (x, -y, z) sits in a group turned flat, so world = (x, z, y).
    controls.current?.fitToSphere(new THREE.Sphere(new THREE.Vector3(c.x, base, c.y), r), !reducedMotion());
  }

  return clusters.map((c) => {
    if (c.members.length > 1) {
      const stamped = c.members.filter((m) => visited.has(m.spot.id)).length;
      return (
        <Html key={c.members.map((m) => m.spot.id).join()} position={[c.x, -c.y, base]} zIndexRange={[5, 0]}>
          <button
            onClick={() => zoomTo(c)}
            aria-label={`${c.members.length} spots here, ${stamped} stamped. Zoom in`}
            className="relative grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-foreground font-display text-sm font-bold text-white shadow-lg transition-transform hover:scale-110"
          >
            {c.members.length}
            {stamped > 0 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full border-2 border-white bg-stamp text-[10px]">
                {stamped}
              </span>
            )}
          </button>
        </Html>
      );
    }
    const { spot, x, y } = c.members[0];
    const { color, Icon } = CATEGORY[spot.category];
    const done = visited.has(spot.id);
    const isSel = spot.id === selected;
    return (
      <Html key={spot.id} position={[x, -y, base]} zIndexRange={[5, 0]}>
        <button
          onClick={() => onSelect(spot.id)}
          aria-label={`${spot.name}${done ? ", stamped" : ""}`}
          className="group relative flex -translate-x-1/2 -translate-y-full flex-col items-center"
        >
          <span
            className={`pointer-events-none absolute bottom-full mb-1.5 whitespace-nowrap rounded-md bg-foreground px-2 py-0.5 text-xs font-medium text-white shadow transition-opacity ${
              isSel ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            }`}
          >
            {spot.name}
          </span>
          <span
            className={`grid size-8 place-items-center rounded-full border-2 shadow-md transition-transform group-hover:scale-110 ${
              isSel ? "scale-110 border-foreground" : "border-white"
            }`}
            style={{ background: done ? color : "#fff", color: done ? "#fff" : color }}
          >
            {done ? <Stamp size={16} strokeWidth={2.5} /> : <Icon size={16} strokeWidth={2.5} />}
          </span>
          <span className="-mt-1 size-2 rotate-45 bg-white shadow" />
        </button>
      </Html>
    );
  });
}

// intro: landing content shown over the map at country level; hidden once you drill in.
export default function MapScene({ intro }: { intro?: React.ReactNode }) {
  const [regions, setRegions] = useState<Collection | null>(null);
  const [cities, setCities] = useState<Collection | null>(null);
  const [view, setView] = useState<View>("country");
  const [hovered, setHovered] = useState<Feature | null>(null);
  const [selected, setSelected] = useState<Feature | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<string | null>(null);
  const [visited, setVisited] = useState(loadVisited); // client-only component, so storage is available
  const [stamp, setStamp] = useState<{ key: number; name: string } | null>(null);
  const [celebrate, setCelebrate] = useState(0); // bump to replay confetti
  const [sunOn, setSunOn] = useState<THREE.Sphere | null>(null);
  const [shadows] = useState(canShadow);
  const homeSun = useRef<THREE.Sphere | null>(null);
  const controls = useRef<CameraControls>(null);

  useEffect(() => {
    fetch("/geo/regions.json").then((r) => r.json()).then(setRegions);
  }, []);

  // Let the stamp and confetti play, then clear them.
  useEffect(() => {
    if (!stamp) return;
    const t = setTimeout(() => setStamp(null), 1400);
    return () => clearTimeout(t);
  }, [stamp]);
  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(0), 3000);
    return () => clearTimeout(t);
  }, [celebrate]);

  // One projection for every level, so cities sit exactly inside their region.
  // Fit to the raw points: d3 reads GeoJSON ring winding as inverted and would fit the whole globe.
  const project = useMemo(() => {
    if (!regions) return null;
    const points = regions.features.flatMap((f) => f.geometry.coordinates.flat(3)) as number[];
    const coordinates = [];
    for (let i = 0; i < points.length; i += 2) coordinates.push([points[i], points[i + 1]]);
    return geoMercator().fitExtent([[-5, -6], [5, 6]], { type: "MultiPoint", coordinates });
  }, [regions]);

  const pct = completion(SPOTS, visited);
  // Fog of war: the city deepens from apricot to stamp red and rises as spots are collected.
  const cityColor = "#" + new THREE.Color(COLOR.cityFrom).lerp(new THREE.Color(COLOR.cityTo), pct).getHexString();
  const cityHeight = 0.1 + 0.15 * pct;

  function toggleVisited(id: string) {
    if (!visited.has(id)) setStamp({ key: Date.now(), name: SPOTS.find((s) => s.id === id)!.name });
    // Build on the latest set, not this render's, so quick taps don't overwrite each other.
    setVisited((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      saveVisited(next);
      return next;
    });
  }

  // Confetti when the city reaches 100% (not on load if it already was).
  const prevPct = useRef(pct);
  useEffect(() => {
    if (pct === 1 && prevPct.current < 1) setCelebrate(Date.now());
    prevPct.current = pct;
  }, [pct]);

  function openRegion() {
    setSelected(null);
    setSelectedSpot(null);
    setHovered(null); // the clicked mesh may unmount, so it never fires pointer-out
    setView("davao");
    if (!cities) fetch("/geo/davao-region.json").then((r) => r.json()).then(setCities);
  }

  function openCity() {
    setSelected(null);
    setHovered(null);
    setView("city");
  }

  function backToCountry() {
    setView("country");
    setSelected(null);
    setSelectedSpot(null);
    setSunOn(homeSun.current);
    controls.current?.reset(!reducedMotion());
  }

  const info = view === "city" ? null : (hovered ?? selected);
  const status = !info
    ? null
    : info.properties.psgc === PILOT_REGION
      ? "Now open · tap to explore"
      : info.properties.psgc === PILOT_CITY
        ? `${Math.round(pct * 100)}% collected · tap to explore`
        : view === "davao"
          ? "Spots coming soon"
          : "Coming soon";

  const pilotCity = cities?.features.find((f) => f.properties.psgc === PILOT_CITY);
  const spotCard = SPOTS.find((s) => s.id === selectedSpot);

  return (
    <div className="relative h-full w-full">
      <Canvas
        shadows={shadows}
        camera={{ position: [0, 14, 8], fov: 35 }}
        fallback={<p className="p-6 text-sm">Your browser can&apos;t show the 3D map.</p>}
      >
        <hemisphereLight args={["#ffffff", "#7cc8d3", 1.4]} />
        <Sun sphere={sunOn} shadows={shadows} />
        <CameraControls
          ref={controls}
          minPolarAngle={0.15}
          maxPolarAngle={0.95}
          minAzimuthAngle={-0.6}
          maxAzimuthAngle={0.6}
          minDistance={0.15}
          maxDistance={30}
          truckSpeed={0}
          smoothTime={0.4}
        />
        {project && regions && (
          // Map is drawn in the XY plane and laid flat; extrusion points up.
          <group rotation-x={-Math.PI / 2}>
            {/* Invisible sea floor that only shows the islands' shadows. */}
            <mesh position-z={-0.001} receiveShadow>
              <planeGeometry args={[60, 60]} />
              <shadowMaterial opacity={0.22} />
            </mesh>
            <FitCamera
              controls={controls}
              isHome
              onFit={(s) => {
                homeSun.current = s;
                setSunOn(s);
              }}
            >
              {regions.features.map((f) => {
                const pilot = f.properties.psgc === PILOT_REGION;
                if (pilot && view !== "country" && cities) return null;
                return (
                  <Area
                    key={f.properties.psgc}
                    feature={f}
                    project={project}
                    color={pilot ? COLOR.pilot : COLOR.stone}
                    hoverColor={pilot ? COLOR.pilotHover : COLOR.stoneHover}
                    height={pilot ? 0.18 : 0.06}
                    lift={view === "country" ? 0.05 : 0}
                    onHover={setHovered}
                    onSelect={(feat) => (pilot ? openRegion() : setSelected(feat))}
                  />
                );
              })}
            </FitCamera>
            {view !== "country" && cities && pilotCity && (
              <>
                <FitCamera controls={controls} active={view === "davao"} onFit={setSunOn}>
                  {cities.features
                    .filter((f) => f !== pilotCity)
                    .map((f) => (
                      <Area
                        key={f.properties.psgc}
                        feature={f}
                        project={project}
                        color={COLOR.sand}
                        hoverColor={COLOR.sandHover}
                        // Neighbors sit lower once you're inside the city, so it stands out.
                        height={view === "city" ? 0.04 : 0.08}
                        lift={view === "city" ? 0 : 0.05}
                        onHover={setHovered}
                        onSelect={setSelected}
                      />
                    ))}
                </FitCamera>
                <FitCamera controls={controls} active={view === "city"} clearSheet onFit={setSunOn}>
                  <Area
                    feature={pilotCity}
                    project={project}
                    color={cityColor}
                    hoverColor={view === "city" ? cityColor : COLOR.pilotHover}
                    height={cityHeight}
                    lift={view === "city" ? 0 : 0.05}
                    onHover={setHovered}
                    onSelect={() => view === "davao" && openCity()}
                  />
                </FitCamera>
                {view === "city" && (
                  <Markers
                    project={project}
                    base={cityHeight}
                    visited={visited}
                    selected={selectedSpot}
                    controls={controls}
                    onSelect={setSelectedSpot}
                  />
                )}
              </>
            )}
          </group>
        )}
      </Canvas>

      {intro && view === "country" && (
        <div className="absolute inset-x-4 top-28 flex flex-col gap-4 rounded-2xl bg-surface/90 p-5 shadow-md sm:top-16 sm:max-w-md lg:left-12 lg:top-1/2 lg:-translate-y-1/2 lg:p-7">
          {intro}
          <button
            onClick={openRegion}
            className="w-fit rounded-full bg-accent px-6 py-3 font-display font-semibold text-white shadow-sm hover:opacity-90"
          >
            Start in Davao
          </button>
        </div>
      )}

      <div className="absolute left-4 right-4 top-14 flex flex-wrap items-center gap-1 text-sm sm:left-auto sm:top-4 sm:justify-end">
        <nav aria-label="Map location" className="flex items-center gap-1">
          <button
            onClick={backToCountry}
            className="rounded-full bg-surface/90 px-3 py-1.5 font-medium shadow-sm hover:bg-surface"
          >
            Philippines
          </button>
          {view !== "country" && (
            <>
              <span aria-hidden className="text-foreground/50">/</span>
              <button
                onClick={openRegion}
                disabled={view === "davao"}
                className="rounded-full bg-surface/90 px-3 py-1.5 font-medium shadow-sm enabled:hover:bg-surface"
              >
                Davao Region
              </button>
            </>
          )}
          {view === "city" && (
            <>
              <span aria-hidden className="text-foreground/50">/</span>
              <span className="rounded-full bg-surface/90 px-3 py-1.5 font-medium shadow-sm">Davao City</span>
            </>
          )}
        </nav>
        <button
          onClick={() => (view === "country" ? controls.current?.reset(!reducedMotion()) : backToCountry())}
          className="ml-2 rounded-full bg-foreground px-3 py-1.5 font-medium text-white shadow-sm hover:opacity-90"
        >
          Reset view
        </button>
      </div>

      {info && (
        <div className="pointer-events-none absolute inset-x-4 bottom-10 rounded-xl bg-surface/95 px-4 py-3 shadow-md sm:inset-x-auto sm:right-4 sm:w-72">
          <p className="font-display font-semibold">{info.properties.name}</p>
          <p className="text-sm text-muted">{status}</p>
        </div>
      )}

      {view === "city" && (
        <SpotPanel
          visited={visited}
          pct={pct}
          selected={selectedSpot}
          onSelect={setSelectedSpot}
          onToggle={toggleVisited}
        />
      )}

      {view === "city" && spotCard && (
        <SpotCard
          spot={spotCard}
          done={visited.has(spotCard.id)}
          onToggle={() => toggleVisited(spotCard.id)}
          onClose={() => setSelectedSpot(null)}
        />
      )}

      <Celebration stamp={stamp} celebrate={celebrate} />
    </div>
  );
}
