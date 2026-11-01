import type { Category } from "./shoplink";

// Ready-made choices for products, so sellers pick instead of typing. The backend stores plain strings
// ("black", "M"), so anything a seller adds by hand still works.

export const COLORS: { name: string; hex: string }[] = [
  { name: "black", hex: "#1f1f24" },
  { name: "white", hex: "#ffffff" },
  { name: "grey", hex: "#9ca0a8" },
  { name: "beige", hex: "#e8d8bd" },
  { name: "brown", hex: "#7a4e2d" },
  { name: "red", hex: "#e23a3a" },
  { name: "pink", hex: "#f48fb1" },
  { name: "orange", hex: "#ff8a3d" },
  { name: "yellow", hex: "#f5d142" },
  { name: "green", hex: "#3ca55c" },
  { name: "olive", hex: "#7c7c3a" },
  { name: "blue", hex: "#3b7fe0" },
  { name: "navy", hex: "#22305e" },
  { name: "purple", hex: "#8a4fd6" },
];

/** How each category is called in the shop (English; shown through t()). */
export const CATEGORY_LABELS: Record<Category, string> = {
  hoodies: "Hoodies",
  "t-shirts": "T-shirts",
  jeans: "Jeans",
  dresses: "Dresses",
  bags: "Bags",
  shoes: "Shoes",
  jackets: "Jackets",
  accessories: "Accessories",
  other: "Other",
};

/** The swatch for a color name, or null for one we don't know (shown as a striped dot). */
export const colorHex = (name: string) => COLORS.find((c) => c.name === name.trim().toLowerCase())?.hex ?? null;

export const SIZE_GROUPS: { label: string; sizes: string[] }[] = [
  { label: "Clothes", sizes: ["XS", "S", "M", "L", "XL", "XXL", "3XL"] },
  { label: "Waist (jeans)", sizes: ["26", "28", "30", "32", "34", "36"] },
  { label: "Shoes", sizes: ["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"] },
  { label: "Other", sizes: ["One size"] },
];
