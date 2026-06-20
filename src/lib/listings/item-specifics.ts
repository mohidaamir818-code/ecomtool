import type { GeneratedListingItemSpecific, ListingProductSource } from "@/types/listing-generator";

export const EBAY_CONDITION_OPTIONS = [
  "New with tags",
  "New without tags",
  "New with defects",
  "Used",
] as const;

export type EbayConditionOption = (typeof EBAY_CONDITION_OPTIONS)[number];

export const DEFAULT_EBAY_CONDITION: EbayConditionOption = "New with tags";

export const SEE_DESCRIPTION = "See Description";
export const UNBRANDED = "Unbranded";
export const MPN_DOES_NOT_APPLY = "DoesNotApply";

export const CANONICAL_ITEM_SPECIFIC_NAMES = [
  "Brand",
  "Type",
  "Color",
  "Material",
  "Size",
  "Unit",
  "Room",
  "Style",
  "Features",
  "Compatible Model",
  "Item Length",
  "Item Width",
  "Item Height",
  "Item Weight",
  "MPN",
  "Number of Items",
] as const;

export type CanonicalItemSpecificName = (typeof CANONICAL_ITEM_SPECIFIC_NAMES)[number];

export interface ItemSpecificFieldDef {
  name: CanonicalItemSpecificName;
  defaultValue: string;
  locked?: boolean;
  options?: string[];
  kind: "select" | "text";
}

const ROOM_OPTIONS = [
  "Office",
  "Bedroom",
  "Living Room",
  "Kitchen",
  "Bathroom",
  "Travel",
  "Outdoor",
  SEE_DESCRIPTION,
];

const MATERIAL_OPTIONS = [
  "Plastic",
  "Metal",
  "Wood",
  "Fabric",
  "Silicone",
  "Glass",
  "Leather",
  "Rubber",
  SEE_DESCRIPTION,
];

const TYPE_OPTIONS = [
  "Travel Pillows",
  "Pillow",
  "Cushion",
  "Accessory",
  "Organizer",
  "Tool",
  SEE_DESCRIPTION,
];

const STYLE_OPTIONS = ["Modern", "Classic", "Minimalist", "Contemporary", SEE_DESCRIPTION];

export const ITEM_SPECIFIC_FIELD_DEFS: ItemSpecificFieldDef[] = [
  { name: "Brand", defaultValue: UNBRANDED, locked: true, kind: "select", options: [UNBRANDED] },
  { name: "Type", defaultValue: SEE_DESCRIPTION, kind: "select", options: TYPE_OPTIONS },
  { name: "Color", defaultValue: SEE_DESCRIPTION, kind: "text" },
  { name: "Material", defaultValue: SEE_DESCRIPTION, kind: "select", options: MATERIAL_OPTIONS },
  { name: "Size", defaultValue: SEE_DESCRIPTION, kind: "text" },
  { name: "Unit", defaultValue: "Unit", kind: "select", options: ["Unit", "Set", "Pair", SEE_DESCRIPTION] },
  { name: "Room", defaultValue: SEE_DESCRIPTION, kind: "select", options: ROOM_OPTIONS },
  { name: "Style", defaultValue: SEE_DESCRIPTION, kind: "select", options: STYLE_OPTIONS },
  { name: "Features", defaultValue: SEE_DESCRIPTION, kind: "text" },
  { name: "Compatible Model", defaultValue: SEE_DESCRIPTION, kind: "text" },
  { name: "Item Length", defaultValue: SEE_DESCRIPTION, kind: "text" },
  { name: "Item Width", defaultValue: SEE_DESCRIPTION, kind: "text" },
  { name: "Item Height", defaultValue: SEE_DESCRIPTION, kind: "text" },
  { name: "Item Weight", defaultValue: SEE_DESCRIPTION, kind: "text" },
  { name: "MPN", defaultValue: MPN_DOES_NOT_APPLY, locked: true, kind: "text" },
  { name: "Number of Items", defaultValue: "1", kind: "select", options: ["1", "2", "3", "4", "5"] },
];

const EXCLUDED_NAMES = new Set([
  "country/region of manufacture",
  "country of origin",
  "condition",
]);

const COLOR_WORDS =
  /^(black|white|gray|grey|red|blue|green|yellow|pink|purple|orange|brown|beige|silver|gold|navy|deep blue|light blue|dark blue|multicolor|multi)$/i;

const SIZE_PATTERN =
  /^(xxs|xs|s|m|l|xl|xxl|xxxl|\d+\s*(cm|mm|in|inch|inches|"|'))$|^\d+(\.\d+)?\s*(cm|mm|in|inch|inches|kg|g|lb|lbs|oz)$/i;

export function extractVariantAttributes(variants?: ListingProductSource["variants"]): {
  colors: string[];
  sizes: string[];
} {
  const colors = new Set<string>();
  const sizes = new Set<string>();

  for (const variant of variants ?? []) {
    const label = variant.label.trim();
    if (!label) continue;

    const parts = label.split(/[/|,]/).map((part) => part.trim());
    for (const part of parts.length > 0 ? parts : [label]) {
      const sizeMatch = part.match(/size\s*[:\-]?\s*(.+)/i);
      const colorMatch = part.match(/color\s*[:\-]?\s*(.+)/i);

      if (sizeMatch?.[1]) sizes.add(sizeMatch[1].trim());
      if (colorMatch?.[1]) colors.add(colorMatch[1].trim());

      if (SIZE_PATTERN.test(part)) sizes.add(part);
      else if (COLOR_WORDS.test(part)) colors.add(part);
      else if (!sizeMatch && !colorMatch && parts.length === 1) {
        colors.add(part);
      }
    }
  }

  return {
    colors: [...colors],
    sizes: [...sizes],
  };
}

export function parseDimensionsFromText(text: string): {
  length?: string;
  width?: string;
  height?: string;
  weight?: string;
} {
  const normalized = text.replace(/\s+/g, " ");

  const length =
    normalized.match(/(?:item\s+)?length\s*[:\-]?\s*([\d.]+\s*(?:cm|mm|in|inch|inches|"|'))/i)?.[1] ??
    normalized.match(/([\d.]+\s*(?:cm|mm|in|inch|inches|"|'))\s*(?:long|length)/i)?.[1];

  const width =
    normalized.match(/(?:item\s+)?width\s*[:\-]?\s*([\d.]+\s*(?:cm|mm|in|inch|inches|"|'))/i)?.[1] ??
    normalized.match(/([\d.]+\s*(?:cm|mm|in|inch|inches|"|'))\s*(?:wide|width)/i)?.[1];

  const height =
    normalized.match(/(?:item\s+)?height\s*[:\-]?\s*([\d.]+\s*(?:cm|mm|in|inch|inches|"|'))/i)?.[1] ??
    normalized.match(/([\d.]+\s*(?:cm|mm|in|inch|inches|"|'))\s*(?:high|height|tall)/i)?.[1];

  const weight =
    normalized.match(/(?:item\s+)?weight\s*[:\-]?\s*([\d.]+\s*(?:g|kg|lb|lbs|oz))/i)?.[1] ??
    normalized.match(/([\d.]+\s*(?:g|kg|lb|lbs|oz))/i)?.[1];

  return {
    length: length?.trim(),
    width: width?.trim(),
    height: height?.trim(),
    weight: weight?.trim(),
  };
}

function normalizeValue(value: string | undefined, fallback: string): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return fallback;
  if (/^unknown$/i.test(trimmed)) return fallback;
  return trimmed;
}

function aiMap(raw: Array<{ name?: string; value?: string }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of raw) {
    const name = String(entry.name ?? "").trim();
    const value = String(entry.value ?? "").trim();
    if (!name || !value) continue;
    if (EXCLUDED_NAMES.has(name.toLowerCase())) continue;
    if (/^unknown$/i.test(value)) continue;
    map.set(name, value);
  }
  return map;
}

function pickAiValue(map: Map<string, string>, names: string[], fallback: string): string {
  for (const name of names) {
    const exact = map.get(name);
    if (exact) return normalizeValue(exact, fallback);

    for (const [key, value] of map.entries()) {
      if (key.toLowerCase() === name.toLowerCase()) {
        return normalizeValue(value, fallback);
      }
    }
  }
  return fallback;
}

export function enforceItemSpecifics(
  raw: Array<{ name?: string; value?: string }> | undefined,
  product: ListingProductSource,
): GeneratedListingItemSpecific[] {
  const ai = aiMap(raw ?? []);
  const { colors, sizes } = extractVariantAttributes(product.variants);
  const dims = parseDimensionsFromText(`${product.title} ${product.description ?? ""}`);

  const colorValue =
    colors.length > 0
      ? colors.slice(0, 3).join(", ")
      : pickAiValue(ai, ["Color", "Colour"], SEE_DESCRIPTION);

  const sizeValue =
    sizes.length > 0
      ? sizes.slice(0, 3).join(", ")
      : pickAiValue(ai, ["Size"], SEE_DESCRIPTION);

  const values: Record<CanonicalItemSpecificName, string> = {
    Brand: UNBRANDED,
    Type: pickAiValue(ai, ["Type", "Product Type"], SEE_DESCRIPTION),
    Color: colorValue,
    Material: pickAiValue(ai, ["Material"], SEE_DESCRIPTION),
    Size: sizeValue,
    Unit: pickAiValue(ai, ["Unit", "Unit Type"], "Unit"),
    Room: pickAiValue(ai, ["Room"], SEE_DESCRIPTION),
    Style: pickAiValue(ai, ["Style"], SEE_DESCRIPTION),
    Features: pickAiValue(ai, ["Features", "Feature"], SEE_DESCRIPTION),
    "Compatible Model": pickAiValue(ai, ["Compatible Model", "Compatibility"], SEE_DESCRIPTION),
    "Item Length": pickAiValue(ai, ["Item Length", "Length"], dims.length ?? SEE_DESCRIPTION),
    "Item Width": pickAiValue(ai, ["Item Width", "Width"], dims.width ?? SEE_DESCRIPTION),
    "Item Height": pickAiValue(ai, ["Item Height", "Height"], dims.height ?? SEE_DESCRIPTION),
    "Item Weight": pickAiValue(ai, ["Item Weight", "Weight"], dims.weight ?? SEE_DESCRIPTION),
    MPN: MPN_DOES_NOT_APPLY,
    "Number of Items": pickAiValue(ai, ["Number of Items", "Number in Pack"], "1"),
  };

  return CANONICAL_ITEM_SPECIFIC_NAMES.map((name) => ({
    name,
    value: values[name],
  }));
}

export function filterSpecificsForCategory(
  specifics: GeneratedListingItemSpecific[],
  categoryAspectNames: string[],
): GeneratedListingItemSpecific[] {
  if (categoryAspectNames.length === 0) return specifics;

  const aliases: Record<string, string[]> = {
    color: ["colour"],
    unit: ["unit type"],
    features: ["feature"],
    "compatible model": ["compatibility"],
    "number of items": ["number in pack"],
  };

  const allowed = new Set(categoryAspectNames.map((name) => name.toLowerCase()));
  allowed.add("brand");
  allowed.add("mpn");

  return specifics.filter((specific) => {
    if (/^unknown$/i.test(specific.value)) return false;
    const nameLower = specific.name.toLowerCase();
    if (allowed.has(nameLower)) return true;
    const aliasList = aliases[nameLower] ?? [];
    return aliasList.some((alias) => allowed.has(alias));
  });
}

export function syncConditionInSpecifics(
  specifics: GeneratedListingItemSpecific[],
): GeneratedListingItemSpecific[] {
  return specifics.filter((specific) => specific.name.toLowerCase() !== "condition");
}

export function countFilledItemSpecifics(specifics: GeneratedListingItemSpecific[]): number {
  return specifics.filter((specific) => {
    if (specific.name === "Brand" || specific.name === "MPN") return true;
    const value = specific.value.trim();
    if (!value) return false;
    if (/^unknown$/i.test(value)) return false;
    if (value === SEE_DESCRIPTION && /item (length|width|height|weight)/i.test(specific.name)) {
      return false;
    }
    return true;
  }).length;
}

export function getFieldDef(name: string): ItemSpecificFieldDef | undefined {
  return ITEM_SPECIFIC_FIELD_DEFS.find(
    (field) => field.name.toLowerCase() === name.toLowerCase(),
  );
}
