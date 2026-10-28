"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { CameraControls, Edges } from "@react-three/drei";
import { geoMercator, type GeoProjection } from "d3-geo";
import * as THREE from "three";

type Props = { psgc: number; name: string; level: string };
type Geo = { type: "Polygon" | "MultiPolygon"; coordinates: number[][][] | number[][][][] };
type Feature = { type: "Feature"; properties: Props; geometry: Geo };
type Collection = { type: "FeatureCollection"; features: Feature[] };

// Only Davao Region has city-level detail in the MVP.
const PILOT_REGION = 1100000000;
const PILOT_CITY = 1130700000; // City of Davao

const COLOR = {
  fog: "#c3ccd5",
  fogHover: "#d8dfe6",
  pilot: "#f2a93b",
  pilotHover: "#f7c46d",
  city: "#f2a93b",
  cityPilot: "#d9480f",
  edge: "#ffffff",
};

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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

function Area({
  feature,
  project,
  color,
  hoverColor,
  height,
  onHover,
  onSelect,
}: {
  feature: Feature;
  project: GeoProjection;
  color: string;
  hoverColor: string;
  height: number;
  onHover: (f: Feature | null) => void;
  onSelect: (f: Feature, mesh: THREE.Object3D) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const geometry = useMemo(
    () => new THREE.ExtrudeGeometry(toShapes(feature.geometry, project), { depth: height, bevelEnabled: false }),
    [feature, project, height],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh
      geometry={geometry}
      position-z={hovered ? 0.05 : 0}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover(feature);
      }}
      onPointerOut={() => {
        setHovered(false);
        onHover(null);
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.delta > 4) return; // was a drag, not a tap
        onSelect(feature, e.object);
      }}
    >
      <meshStandardMaterial color={hovered ? hoverColor : color} roughness={0.8} />
      <Edges threshold={20} color={COLOR.edge} />
    </mesh>
  );
}

// Frames the camera on its children when they mount. Lives inside the Canvas so its
// effect runs after its meshes exist (the Canvas mounts its tree separately).
// isHome: fit instantly and save it as the "Reset view" target.
function FitCamera({
  controls,
  isHome = false,
  children,
}: {
  controls: React.RefObject<CameraControls | null>;
  isHome?: boolean;
  children: React.ReactNode;
}) {
  const group = useRef<THREE.Group>(null);
  useEffect(() => {
    const c = controls.current;
    if (!c || !group.current) return;
    group.current.updateWorldMatrix(true, true); // not rendered yet, so world matrix is stale
    const sphere = new THREE.Box3().setFromObject(group.current).getBoundingSphere(new THREE.Sphere());
    c.fitToSphere(sphere, !isHome && !reducedMotion()).then(() => isHome && c.saveState());
  }, [controls, isHome]);
  return <group ref={group}>{children}</group>;
}

// intro: landing content shown over the map at country level; hidden once you drill in.
export default function MapScene({ intro }: { intro?: React.ReactNode }) {
  const [regions, setRegions] = useState<Collection | null>(null);
  const [cities, setCities] = useState<Collection | null>(null);
  const [view, setView] = useState<"country" | "davao">("country");
  const [hovered, setHovered] = useState<Feature | null>(null);
  const [selected, setSelected] = useState<Feature | null>(null);
  const controls = useRef<CameraControls>(null);

  useEffect(() => {
    fetch("/geo/regions.json").then((r) => r.json()).then(setRegions);
  }, []);

  // One projection for every level, so cities sit exactly inside their region.
  // Fit to the raw points: d3 reads GeoJSON ring winding as inverted and would fit the whole globe.
  const project = useMemo(() => {
    if (!regions) return null;
    const points = regions.features.flatMap((f) => f.geometry.coordinates.flat(3)) as number[];
    const coordinates = [];
    for (let i = 0; i < points.length; i += 2) coordinates.push([points[i], points[i + 1]]);
    return geoMercator().fitExtent([[-5, -6], [5, 6]], { type: "MultiPoint", coordinates });
  }, [regions]);

  function openPilot() {
    setSelected(null);
    setHovered(null); // the region mesh unmounts, so it never fires pointer-out
    setView("davao");
    if (!cities) fetch("/geo/davao-region.json").then((r) => r.json()).then(setCities);
  }

  function backToCountry() {
    setView("country");
    setSelected(null);
    controls.current?.reset(!reducedMotion());
  }

  const info = hovered ?? selected;
  const status = !info
    ? null
    : info.properties.psgc === PILOT_REGION
      ? "Now open · tap to explore"
      : view === "davao"
        ? info.properties.psgc === PILOT_CITY
          ? "Pilot city · spots coming soon"
          : "Spots coming soon"
        : "Coming soon";

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [0, 14, 8], fov: 35 }}
        fallback={<p className="p-6 text-sm">Your browser can&apos;t show the 3D map.</p>}
      >
        <ambientLight intensity={1.6} />
        <directionalLight position={[4, 10, 6]} intensity={1.8} />
        <CameraControls
          ref={controls}
          minPolarAngle={0.15}
          maxPolarAngle={0.95}
          minAzimuthAngle={-0.6}
          maxAzimuthAngle={0.6}
          minDistance={1.5}
          maxDistance={30}
          truckSpeed={0}
          smoothTime={0.4}
        />
        {project && regions && (
          // Map is drawn in the XY plane and laid flat; extrusion points up.
          <group rotation-x={-Math.PI / 2}>
            <FitCamera controls={controls} isHome>
              {regions.features.map((f) => {
                const pilot = f.properties.psgc === PILOT_REGION;
                if (pilot && view === "davao" && cities) return null;
                return (
                  <Area
                    key={f.properties.psgc}
                    feature={f}
                    project={project}
                    color={pilot ? COLOR.pilot : COLOR.fog}
                    hoverColor={pilot ? COLOR.pilotHover : COLOR.fogHover}
                    height={pilot ? 0.18 : 0.06}
                    onHover={setHovered}
                    onSelect={(feat) => (pilot ? openPilot() : setSelected(feat))}
                  />
                );
              })}
            </FitCamera>
            {view === "davao" && cities && (
              <FitCamera controls={controls}>
                {cities.features.map((f) => {
                  const pilot = f.properties.psgc === PILOT_CITY;
                  return (
                    <Area
                      key={f.properties.psgc}
                      feature={f}
                      project={project}
                      color={pilot ? COLOR.cityPilot : COLOR.city}
                      hoverColor={COLOR.pilotHover}
                      height={pilot ? 0.12 : 0.08}
                      onHover={setHovered}
                      onSelect={setSelected}
                    />
                  );
                })}
              </FitCamera>
            )}
          </group>
        )}
      </Canvas>

      {intro && view === "country" && (
        <div className="absolute inset-x-4 top-16 flex flex-col gap-4 rounded-2xl bg-surface/90 p-5 shadow-md sm:max-w-md lg:left-12 lg:top-1/2 lg:-translate-y-1/2 lg:bg-transparent lg:p-0 lg:shadow-none">
          {intro}
          <button
            onClick={openPilot}
            className="w-fit rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-sm hover:opacity-90"
          >
            Start in Davao
          </button>
        </div>
      )}

      <div className="absolute right-4 top-4 flex flex-wrap items-center justify-end gap-1 text-sm">
        <nav aria-label="Map location" className="flex items-center gap-1">
          <button
            onClick={backToCountry}
            className="rounded-full bg-surface/90 px-3 py-1.5 font-medium shadow-sm hover:bg-surface"
          >
            Philippines
          </button>
          {view === "davao" && (
            <>
              <span aria-hidden className="text-muted">/</span>
              <span className="rounded-full bg-surface/90 px-3 py-1.5 font-medium shadow-sm">Davao Region</span>
            </>
          )}
        </nav>
        <button
          onClick={() => (view === "davao" ? backToCountry() : controls.current?.reset(!reducedMotion()))}
          className="ml-2 rounded-full bg-surface/90 px-3 py-1.5 font-medium shadow-sm hover:bg-surface"
        >
          Reset view
        </button>
      </div>

      {info && (
        <div className="pointer-events-none absolute inset-x-4 bottom-10 rounded-xl bg-surface/95 px-4 py-3 shadow-md sm:inset-x-auto sm:right-4 sm:w-72">
          <p className="font-semibold">{info.properties.name}</p>
          <p className="text-sm text-muted">{status}</p>
        </div>
      )}
    </div>
  );
}
