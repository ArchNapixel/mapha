import { Church, Landmark, Leaf, Trees, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { Category } from "@/lib/spots";

// One color and icon per spot category, shared by map markers, the spot list and the spot card.
export const CATEGORY: Record<Category, { color: string; Icon: LucideIcon }> = {
  "Churches & temples": { color: "#7048e8", Icon: Church },
  Parks: { color: "#2b8a3e", Icon: Trees },
  "Museums & heritage": { color: "#1864ab", Icon: Landmark },
  "Nature & wildlife": { color: "#0b7285", Icon: Leaf },
  "Food & views": { color: "#d9480f", Icon: UtensilsCrossed },
};
