// Downloads boundary GeoJSON into public/geo. Run: node scripts/fetch-geo.mjs
// Source: faeldon/philippines-json-maps (PSGC 2026-3Q), boundaries by NAMRIA & PSA via OCHA COD-AB, CC BY-IGO.
import { mkdir, writeFile } from "node:fs/promises";

const BASE = "https://raw.githubusercontent.com/faeldon/philippines-json-maps/master/latest/geojson";
const DAVAO_PROVINCES = [1102300000, 1102400000, 1102500000, 1108200000, 1108600000];

// 4 decimals ≈ 11 m, plenty for a map piece; cuts file size a lot.
const round = (c) => (typeof c[0] === "number" ? c.map((n) => Math.round(n * 1e4) / 1e4) : c.map(round));

async function get(path) {
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json();
}

function slim(features, code, name) {
  return {
    type: "FeatureCollection",
    features: features.map((f) => ({
      type: "Feature",
      properties: { psgc: f.properties[code], name: f.properties[name], level: f.properties.geo_level },
      geometry: { type: f.geometry.type, coordinates: round(f.geometry.coordinates) },
    })),
  };
}

await mkdir("public/geo", { recursive: true });

const country = await get("country/lowres/country.0.001.json");
await writeFile("public/geo/regions.json", JSON.stringify(slim(country.features, "adm1_psgc", "adm1_en")));

const provinces = await Promise.all(DAVAO_PROVINCES.map((p) => get(`provdists/lowres/municities-provdist-${p}.0.001.json`)));
const cities = provinces.flatMap((p) => p.features);
await writeFile("public/geo/davao-region.json", JSON.stringify(slim(cities, "adm3_psgc", "adm3_en")));

console.log(`regions: ${country.features.length}, davao region cities/municipalities: ${cities.length}`);
