// Visited spots, kept in this browser until sign-in and the database exist.
// Stores spot ids only: no location, no time.
import type { Spot } from "./spots";

const KEY = "mapho:visited";

export function loadVisited(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]"));
  } catch {
    return new Set();
  }
}

export function saveVisited(ids: Set<string>) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    // private mode or storage blocked: marks last until the tab closes
  }
}

// Weighted share of spots visited, 0..1.
export function completion(spots: Spot[], visited: Set<string>) {
  const total = spots.reduce((s, x) => s + x.weight, 0);
  const done = spots.reduce((s, x) => s + (visited.has(x.id) ? x.weight : 0), 0);
  return total ? done / total : 0;
}
