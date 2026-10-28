// Davao City pilot spots. Temporary home until the database exists; the owner seeds the DB from this list.
// Coordinates: OpenStreetMap (Nominatim), looked up 2026-10-28. Used for map pins only.

export type Category = "Churches & temples" | "Parks" | "Museums & heritage" | "Nature & wildlife" | "Food & views";

export type Spot = {
  id: string;
  name: string;
  category: Category;
  lat: number;
  lon: number;
  weight: number;
  // Optional photo, a path under public/ (e.g. "/spots/peoples-park.jpg"). Only use photos you have rights to.
  photo?: string;
};

export const DAVAO_CITY_PSGC = 1130700000;

export const SPOTS: Spot[] = [
  { id: "san-pedro-cathedral", name: "San Pedro Cathedral", category: "Churches & temples", lat: 7.06472, lon: 125.60948, weight: 1 },
  { id: "shrine-holy-infant-jesus", name: "Shrine of the Holy Infant Jesus of Prague", category: "Churches & temples", lat: 7.06559, lon: 125.57835, weight: 1 },
  { id: "lon-wa-temple", name: "Lon Wa Buddhist Temple", category: "Churches & temples", lat: 7.09557, lon: 125.62065, weight: 1 },
  { id: "peoples-park", name: "People's Park", category: "Parks", lat: 7.07093, lon: 125.60879, weight: 1 },
  { id: "magsaysay-park", name: "Magsaysay Park", category: "Parks", lat: 7.07437, lon: 125.62583, weight: 1 },
  { id: "osmena-park", name: "Rizal Park (Osmeña Park)", category: "Parks", lat: 7.06371, lon: 125.60933, weight: 1 },
  { id: "museo-dabawenyo", name: "Museo Dabawenyo", category: "Museums & heritage", lat: 7.07939, lon: 125.60449, weight: 1 },
  { id: "d-bone-collector", name: "D' Bone Collector Museum", category: "Museums & heritage", lat: 7.06107, lon: 125.61261, weight: 1 },
  { id: "japanese-tunnel", name: "Japanese Tunnel", category: "Museums & heritage", lat: 7.06577, lon: 125.56329, weight: 1 },
  { id: "davao-city-hall", name: "Davao City Hall", category: "Museums & heritage", lat: 7.06445, lon: 125.60772, weight: 1 },
  { id: "philippine-eagle-center", name: "Philippine Eagle Center", category: "Nature & wildlife", lat: 7.18488, lon: 125.41529, weight: 1 },
  { id: "crocodile-park", name: "Davao Crocodile Park", category: "Nature & wildlife", lat: 7.09711, lon: 125.59896, weight: 1 },
  { id: "eden-nature-park", name: "Eden Nature Park", category: "Nature & wildlife", lat: 7.02824, lon: 125.40175, weight: 1 },
  { id: "malagos-garden", name: "Malagos Garden Resort", category: "Nature & wildlife", lat: 7.19104, lon: 125.42766, weight: 1 },
  { id: "puentespina-orchid", name: "Puentespina Orchid Garden", category: "Nature & wildlife", lat: 7.08852, lon: 125.62511, weight: 1 },
  { id: "roxas-night-market", name: "Roxas Night Market", category: "Food & views", lat: 7.07042, lon: 125.61337, weight: 1 },
  { id: "jacks-ridge", name: "Jack's Ridge", category: "Food & views", lat: 7.06651, lon: 125.58212, weight: 1 },
];
