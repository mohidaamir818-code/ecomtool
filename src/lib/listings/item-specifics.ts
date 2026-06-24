import type {
  GeneratedListing,
  GeneratedListingItemSpecific,
  ListingProductSource,
} from "@/types/listing-generator";

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
export const MPN_DOES_NOT_APPLY_EBAY = "Does Not Apply";

export const DEPARTMENT_OPTIONS = ["Men's", "Women's", "Unisex", "Boys", "Girls"] as const;
export const SIZE_TYPE_OPTIONS = ["Regular", "Plus", "Petite"] as const;
export const AGE_GROUP_OPTIONS = ["Adult", "Kids"] as const;

export type DepartmentValue = (typeof DEPARTMENT_OPTIONS)[number];

export const CLOTHING_ITEM_SPECIFIC_NAMES = ["Department", "Size Type", "Age Group"] as const;

export const CANONICAL_ITEM_SPECIFIC_NAMES = [
  "Brand",
  "Type",
  "Department",
  "Size Type",
  "Age Group",
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
  {
    name: "Department",
    defaultValue: "Unisex",
    kind: "select",
    options: [...DEPARTMENT_OPTIONS],
  },
  {
    name: "Size Type",
    defaultValue: "Regular",
    kind: "select",
    options: [...SIZE_TYPE_OPTIONS],
  },
  {
    name: "Age Group",
    defaultValue: "Adult",
    kind: "select",
    options: [...AGE_GROUP_OPTIONS],
  },
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

function stripHtml(text: string): string {
  return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function combineProductText(title: string, description?: string): string {
  return `${title} ${stripHtml(description ?? "")}`.replace(/\s+/g, " ").trim();
}

export function detectDepartmentFromText(title: string, description?: string): DepartmentValue {
  const text = combineProductText(title, description).toLowerCase();

  if (/\bwomen'?s?\b|\bladies\b|\blady'?s\b|\bfor women\b|\bwomens\b/.test(text)) {
    return "Women's";
  }
  if (/\bmen'?s?\b|\bfor men\b|\bmens\b/.test(text) && !/\bwomen/.test(text)) {
    return "Men's";
  }
  if (/\bgirls?\b|\bfor girls\b/.test(text)) {
    return "Girls";
  }
  if (/\bboys?\b|\bfor boys\b/.test(text)) {
    return "Boys";
  }
  if (/\bkids?\b|\bchildren'?s?\b|\btoddler\b|\binfant\b|\bbaby\b/.test(text)) {
    if (/\bgirl/.test(text)) return "Girls";
    if (/\bboy/.test(text)) return "Boys";
    return "Unisex";
  }

  return "Unisex";
}

export function detectAgeGroupFromText(title: string, description?: string): string {
  const text = combineProductText(title, description).toLowerCase();

  if (
    /\bkids?\b|\bchildren'?s?\b|\btoddler\b|\binfant\b|\bbaby\b|\bboys?\b|\bgirls?\b/.test(text)
  ) {
    return "Kids";
  }

  return "Adult";
}

export function detectSizeTypeFromText(title: string, description?: string): string {
  const text = combineProductText(title, description).toLowerCase();

  if (/\bplus size\b|\bplus-size\b|\bsize plus\b|\bplus\b/.test(text)) {
    return "Plus";
  }
  if (/\bpetite\b/.test(text)) {
    return "Petite";
  }

  return "Regular";
}

export function findItemSpecificValue(
  specifics: GeneratedListingItemSpecific[],
  name: string,
): string | undefined {
  const match = specifics.find((specific) => specific.name.toLowerCase() === name.toLowerCase());
  const value = match?.value?.trim();
  return value || undefined;
}

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
      const colorMatch = part.match(/colou?r\s*[:\-]?\s*(.+)/i);

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

function capitalizeColorWord(word: string): string {
  if (/^multicolor$/i.test(word) || /^multi$/i.test(word)) return "Multicolor";
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

export function detectColorsFromText(title: string, description?: string): string[] {
  const text = combineProductText(title, description);
  const found = new Set<string>();

  const labelled = text.matchAll(/colou?r\s*[:\-]?\s*([a-zA-Z][\w\s-]*)/gi);
  for (const match of labelled) {
    const value = match[1]?.trim();
    if (value) found.add(capitalizeColorWord(value.split(/[,/|]/)[0]?.trim() ?? value));
  }

  for (const token of text.split(/[\s,/|]+/)) {
    const cleaned = token.replace(/[^\w-]/g, "").trim();
    if (cleaned && COLOR_WORDS.test(cleaned)) {
      found.add(capitalizeColorWord(cleaned));
    }
  }

  return [...found];
}

export function splitAspectValues(value: string): string[] {
  return value
    .split(/,\s*/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/^unknown$/i.test(part));
}

const EBAY_MULTI_VALUE_ASPECT_KEYS = new Set(["colour", "color", "size"]);

function aspectValuesForSpecific(nameLower: string, rawValue: string): string[] {
  if (EBAY_MULTI_VALUE_ASPECT_KEYS.has(nameLower)) {
    return splitAspectValues(rawValue);
  }

  const trimmed = rawValue.trim();
  if (!trimmed || /^unknown$/i.test(trimmed)) return [];
  return [trimmed];
}

export function enforceSingleValueEbayAspects(
  aspects: Record<string, string[]>,
  marketplaceId: string,
): Record<string, string[]> {
  const colourKey = marketplaceId === "EBAY_GB" ? "colour" : "color";
  const multiValueKeys = new Set([colourKey, "colour", "color", "size"]);
  const result: Record<string, string[]> = {};

  for (const [key, values] of Object.entries(aspects)) {
    if (multiValueKeys.has(key.toLowerCase())) {
      result[key] = values;
      continue;
    }
    if (values.length <= 1) {
      result[key] = values;
      continue;
    }
    result[key] = [values[0]];
  }

  return result;
}

export interface EbayAspectSourceContext {
  listing: GeneratedListing;
  product?: ListingProductSource;
  variantDrafts?: Array<{ label: string }>;
  marketplaceId: string;
}

function collectVariantLabels(context: EbayAspectSourceContext): string[] {
  const labels: string[] = [];
  for (const variant of context.product?.variants ?? []) {
    if (variant.label.trim()) labels.push(variant.label.trim());
  }
  for (const variant of context.variantDrafts ?? []) {
    if (variant.label.trim()) labels.push(variant.label.trim());
  }
  return labels;
}

const SIZE_PATTERNS = [
  /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|XXL|XXXL|XXXXL)$/i,
  /^\d+$/,
  /^\d+\s*-\s*\d+$/,
  /^(small|medium|large|extra\s*large)$/i,
  /^(one size|free size|universal)$/i,
  /^\d+(cm|mm|inch|kg|g|oz|ml|l)$/i,
  /^(EU|UK|US)\s*\d+$/i,
] as const;

const PROTECTED_ASPECT_KEYS = new Set(["Colour", "Color", "Size"]);

function splitVariantLabelParts(label: string): string[] {
  return label
    .split(/\s*\/\s*|\s*\|\s*|,\s*|\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function isVariantSizePart(part: string): boolean {
  const trimmed = part.trim();
  if (!trimmed) return false;
  return SIZE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function isVariantColourPart(part: string): boolean {
  const trimmed = part.trim();
  if (!trimmed) return false;
  if (trimmed.length >= 30) return false;
  return !isVariantSizePart(trimmed);
}

export function extractColourForLabel(label: string): string | null {
  const parts = splitVariantLabelParts(label);
  const colourPart = parts.find(isVariantColourPart);
  if (!colourPart) return null;
  return capitalizeColorWord(colourPart);
}

export function extractSizeForLabel(label: string): string | null {
  const parts = splitVariantLabelParts(label);
  const sizePart = parts.find(isVariantSizePart);
  if (!sizePart) return null;
  return sizePart;
}

export function extractColoursAndSizesFromLabels(labels: string[]): {
  colors: string[];
  sizes: string[];
} {
  const colors: string[] = [];
  const sizes: string[] = [];

  const sizePatterns = [
    /^(XXS|XS|S|M|L|XL|2XL|3XL|4XL|5XL|XXL|XXXL|XXXXL)$/i,
    /^\d+$/,
    /^\d+\s*-\s*\d+$/,
    /^(small|medium|large|extra\s*large)$/i,
    /^(one size|free size|universal)$/i,
    /^\d+(cm|mm|inch|inches|kg|g|oz|ml|l)$/i,
    /^(EU|UK|US)\s*\d+$/i,
    /^\d+\/\d+$/,
  ];

  for (const label of labels) {
    if (!label?.trim()) continue;

    const parts = label
      .split("/")
      .map((p) => p.trim())
      .filter(Boolean);

    if (parts.length === 0) continue;

    const firstPart = parts[0];
    const isFirstSize = sizePatterns.some((p) => p.test(firstPart));

    if (!isFirstSize && firstPart) {
      if (!colors.includes(firstPart)) {
        colors.push(firstPart);
      }
    }

    if (parts.length > 1) {
      const lastPart = parts[parts.length - 1];
      const isLastSize = sizePatterns.some((p) => p.test(lastPart));
      if (isLastSize && !sizes.includes(lastPart)) {
        sizes.push(lastPart);
      } else if (!isLastSize && !colors.includes(lastPart)) {
        sizes.push(lastPart);
      }
    } else if (isFirstSize) {
      if (!sizes.includes(firstPart)) {
        sizes.push(firstPart);
      }
    }
  }

  return {
    colors: colors.length > 0 ? colors : ["Multicolor"],
    sizes: sizes.length > 0 ? sizes : ["One Size"],
  };
}

export const EBAY_ASPECT_SAFE_DEFAULTS: Record<string, string[]> = {
  Size: ["One Size"],
  Colour: ["Multicolor"],
  Color: ["Multicolor"],
  Department: ["Unisex"],
  Material: ["See Description"],
  Pattern: ["See Description"],
  Style: ["Casual"],
  Fit: ["Regular"],
  "Age Group": ["Adult"],
  "Size Type": ["Regular"],
  Occasion: ["Casual"],
  Season: ["All Seasons"],
  "Sleeve Length": ["See Description"],
  Neckline: ["See Description"],
  "Fabric Type": ["See Description"],
  "Care Instructions": ["Machine Wash"],
  Features: ["See Description"],
  Theme: ["See Description"],
  Closure: ["See Description"],
  Lining: ["See Description"],
  "Pocket Type": ["See Description"],
};

export function getSafeAspectDefault(fieldName: string): string[] {
  const direct = EBAY_ASPECT_SAFE_DEFAULTS[fieldName];
  if (direct) return direct;

  const lower = fieldName.toLowerCase();
  if (lower === "color" || lower === "colour") {
    return EBAY_ASPECT_SAFE_DEFAULTS.Colour;
  }

  for (const [key, value] of Object.entries(EBAY_ASPECT_SAFE_DEFAULTS)) {
    if (key.toLowerCase() === lower) return value;
  }

  return [SEE_DESCRIPTION];
}

export function buildAspectSafeDefaults(extracted: {
  colors: string[];
  sizes: string[];
}): Record<string, string[]> {
  const colours = extracted.colors.length > 0 ? extracted.colors : ["Multicolor"];
  const sizes = extracted.sizes.length > 0 ? extracted.sizes : ["One Size"];

  return {
    ...EBAY_ASPECT_SAFE_DEFAULTS,
    Colour: colours,
    Color: colours,
    Size: sizes,
  };
}

function isPlaceholderAspectValue(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return true;
  if (/^unknown$/i.test(trimmed)) return true;
  if (trimmed === SEE_DESCRIPTION) return true;
  return false;
}

export function resolveColourValues(context: EbayAspectSourceContext): string[] {
  const { listing, product } = context;
  const title = product?.title ?? listing.seoTitle;
  const description = product?.description ?? listing.descriptionHtml;
  const colours = new Set<string>();

  const fromVariants = extractColoursAndSizesFromLabels(collectVariantLabels(context));
  for (const colour of fromVariants.colors) {
    colours.add(colour);
  }

  const aiColour = findItemSpecificValue(listing.itemSpecifics, "Color")
    ?? findItemSpecificValue(listing.itemSpecifics, "Colour");
  if (aiColour && !isPlaceholderAspectValue(aiColour)) {
    for (const part of splitAspectValues(aiColour)) {
      colours.add(capitalizeColorWord(part));
    }
  }

  for (const colour of detectColorsFromText(title, description)) {
    colours.add(colour);
  }

  if (colours.size === 0) {
    return ["Multicolor"];
  }

  return [...colours];
}

export function resolveSizeValues(context: EbayAspectSourceContext): string[] {
  const { listing, product } = context;
  const title = product?.title ?? listing.seoTitle;
  const description = product?.description ?? listing.descriptionHtml;
  const sizes = new Set<string>();

  const fromVariants = extractColoursAndSizesFromLabels(collectVariantLabels(context));
  for (const size of fromVariants.sizes) {
    sizes.add(size);
  }

  const aiSize = findItemSpecificValue(listing.itemSpecifics, "Size");
  if (aiSize && !isPlaceholderAspectValue(aiSize)) {
    for (const part of splitAspectValues(aiSize)) {
      sizes.add(part);
    }
  }

  const sizeInText = combineProductText(title, description).match(
    /size\s*[:\-]?\s*([a-zA-Z0-9][\w\s.-]*)/i,
  )?.[1];
  if (sizeInText?.trim()) {
    sizes.add(sizeInText.trim());
  }

  if (sizes.size === 0) {
    return ["One Size"];
  }

  return [...sizes];
}

export function normalizeAspectNameForMarketplace(
  name: string,
  marketplaceId: string,
): string {
  if (marketplaceId === "EBAY_GB" && name.toLowerCase() === "color") {
    return "Colour";
  }
  return name;
}

function pickSpecificValue(
  specifics: GeneratedListingItemSpecific[],
  names: string[],
  fallback: string,
): string {
  for (const name of names) {
    const value = findItemSpecificValue(specifics, name);
    if (value && !isPlaceholderAspectValue(value)) {
      return value;
    }
  }
  return fallback;
}

const MATERIAL_KEYWORDS = [
  "Cotton",
  "Polyester",
  "Nylon",
  "Spandex",
  "Elastane",
  "Leather",
  "Wool",
  "Silk",
  "Denim",
  "Linen",
  "Rayon",
  "Viscose",
  "Acrylic",
  "Fleece",
  "Suede",
  "Canvas",
  "Mesh",
  "Velvet",
  "Satin",
  "Chiffon",
  "Rubber",
  "Plastic",
  "Metal",
  "Wood",
  "Glass",
  "Silicone",
  "Fabric",
] as const;

export function detectMaterialFromText(title: string, description?: string): string | null {
  const text = combineProductText(title, description).toLowerCase();

  for (const material of MATERIAL_KEYWORDS) {
    if (text.includes(material.toLowerCase())) {
      return material;
    }
  }

  const labelled = text.match(/material\s*[:\-]?\s*([a-zA-Z][\w\s-]*)/i)?.[1]?.trim();
  if (labelled && labelled.length > 1 && labelled.length < 40) {
    return labelled.charAt(0).toUpperCase() + labelled.slice(1);
  }

  return null;
}

function resolveMaterialValue(context: EbayAspectSourceContext): string {
  const { listing, product } = context;
  const title = product?.title ?? listing.seoTitle;
  const description = product?.description ?? listing.descriptionHtml;
  const specifics = listing.itemSpecifics;

  const fromAi = pickSpecificValue(specifics, ["Material", "Fabric Type"], SEE_DESCRIPTION);
  if (fromAi !== SEE_DESCRIPTION) return fromAi;

  return detectMaterialFromText(title, description) ?? SEE_DESCRIPTION;
}

export function buildDefaultEbayUkAspects(
  context: EbayAspectSourceContext,
): Record<string, string[]> {
  const { listing, product } = context;
  const title = product?.title ?? listing.seoTitle;
  const description = product?.description ?? listing.descriptionHtml;
  const specifics = listing.itemSpecifics;
  const material = resolveMaterialValue(context);

  return {
    Brand: [UNBRANDED],
    MPN: [MPN_DOES_NOT_APPLY_EBAY],
    Department: [
      pickSpecificValue(specifics, ["Department"], detectDepartmentFromText(title, description)),
    ],
    Colour: resolveColourValues(context),
    Size: resolveSizeValues(context),
    Material: [material],
    Pattern: [pickSpecificValue(specifics, ["Pattern"], SEE_DESCRIPTION)],
    Occasion: [pickSpecificValue(specifics, ["Occasion"], "Casual")],
    Season: [pickSpecificValue(specifics, ["Season"], "All Seasons")],
    Type: [pickSpecificValue(specifics, ["Type", "Product Type"], SEE_DESCRIPTION)],
    Fit: [pickSpecificValue(specifics, ["Fit"], "Regular")],
    "Sleeve Length": [pickSpecificValue(specifics, ["Sleeve Length"], SEE_DESCRIPTION)],
    Neckline: [pickSpecificValue(specifics, ["Neckline"], SEE_DESCRIPTION)],
    Features: [pickSpecificValue(specifics, ["Features", "Feature"], SEE_DESCRIPTION)],
    "Age Group": [
      pickSpecificValue(specifics, ["Age Group"], detectAgeGroupFromText(title, description)),
    ],
    "Size Type": [
      pickSpecificValue(specifics, ["Size Type"], detectSizeTypeFromText(title, description)),
    ],
    Style: [pickSpecificValue(specifics, ["Style"], "Casual")],
    Theme: [pickSpecificValue(specifics, ["Theme"], SEE_DESCRIPTION)],
    "Fabric Type": [material],
    "Care Instructions": [
      pickSpecificValue(specifics, ["Care Instructions"], "Machine Wash"),
    ],
    Closure: [pickSpecificValue(specifics, ["Closure"], SEE_DESCRIPTION)],
    Lining: [pickSpecificValue(specifics, ["Lining"], SEE_DESCRIPTION)],
    "Pocket Type": [pickSpecificValue(specifics, ["Pocket Type"], SEE_DESCRIPTION)],
    "Country/Region of Manufacture": [MPN_DOES_NOT_APPLY_EBAY],
  };
}

export function aspectsFromListingSpecifics(
  listing: GeneratedListing,
  marketplaceId: string,
): Record<string, string[]> {
  const aspects: Record<string, string[]> = {};

  for (const specific of listing.itemSpecifics) {
    const nameLower = specific.name.toLowerCase();
    if (nameLower === "brand") {
      aspects.Brand = [UNBRANDED];
      continue;
    }
    if (nameLower === "condition") continue;
    if (nameLower === "color" || nameLower === "colour" || nameLower === "size") continue;

    const normalizedName = normalizeAspectNameForMarketplace(specific.name, marketplaceId);
    const values = aspectValuesForSpecific(nameLower, specific.value);
    if (values.length === 0) continue;

    if (normalizedName === "MPN" && values[0] === MPN_DOES_NOT_APPLY) {
      aspects.MPN = [MPN_DOES_NOT_APPLY_EBAY];
      continue;
    }

    aspects[normalizedName] = values;
  }

  const colourKey = marketplaceId === "EBAY_GB" ? "Colour" : "Color";
  if (aspects.Color && colourKey === "Colour") {
    if (!aspects.Colour) aspects.Colour = aspects.Color;
    delete aspects.Color;
  } else if (aspects.Colour && colourKey === "Color") {
    if (!aspects.Color) aspects.Color = aspects.Colour;
    delete aspects.Colour;
  }

  return aspects;
}

export function mergeEbayAspects(
  defaults: Record<string, string[]>,
  aiAspects: Record<string, string[]>,
  overrides?: Record<string, string[]>,
): Record<string, string[]> {
  const merged: Record<string, string[]> = { ...defaults };

  for (const [name, values] of Object.entries(aiAspects)) {
    if (PROTECTED_ASPECT_KEYS.has(name)) continue;
    const meaningful = values.filter((value) => !isPlaceholderAspectValue(value));
    if (meaningful.length > 0) {
      merged[name] = meaningful;
    }
  }

  for (const [name, values] of Object.entries(overrides ?? {})) {
    if (values.length > 0) {
      merged[name] = values;
    }
  }

  if (!merged.Brand?.length) merged.Brand = [UNBRANDED];
  if (!merged.MPN?.length) {
    merged.MPN = [MPN_DOES_NOT_APPLY_EBAY];
  } else if (merged.MPN[0] === MPN_DOES_NOT_APPLY) {
    merged.MPN = [MPN_DOES_NOT_APPLY_EBAY];
  }

  return merged;
}

export function enforceProtectedEbayAspects(
  aspects: Record<string, string[]>,
  context: EbayAspectSourceContext,
): Record<string, string[]> {
  const extracted = extractColoursAndSizesFromLabels(collectVariantLabels(context));
  const colourKey = context.marketplaceId === "EBAY_GB" ? "Colour" : "Color";
  const alternateColourKey = colourKey === "Colour" ? "Color" : "Colour";

  delete aspects[alternateColourKey];

  if (extracted.colors.length > 0) {
    aspects[colourKey] = extracted.colors;
  } else if (!aspects[colourKey]?.length) {
    aspects[colourKey] = ["Multicolor"];
  }

  if (extracted.sizes.length > 0) {
    aspects.Size = extracted.sizes;
  } else if (!aspects.Size?.length) {
    aspects.Size = ["One Size"];
  }

  return aspects;
}

export function resolveRequiredEbayAspects(
  context: EbayAspectSourceContext,
): Record<string, string[]> {
  const { listing, product } = context;
  const title = product?.title ?? listing.seoTitle;
  const description = product?.description ?? listing.descriptionHtml;
  const specifics = listing.itemSpecifics;
  const dims = parseDimensionsFromText(`${title} ${description ?? ""}`);
  const colourKey =
    context.marketplaceId === "EBAY_GB" ? "Colour" : "Color";

  return {
    Brand: [UNBRANDED],
    MPN: [MPN_DOES_NOT_APPLY_EBAY],
    Department: [
      pickSpecificValue(specifics, ["Department"], detectDepartmentFromText(title, description)),
    ],
    [colourKey]: resolveColourValues(context),
    Size: resolveSizeValues(context),
    Material: [pickSpecificValue(specifics, ["Material"], SEE_DESCRIPTION)],
    Pattern: [pickSpecificValue(specifics, ["Pattern"], "Solid")],
    Occasion: [pickSpecificValue(specifics, ["Occasion"], "Casual")],
    Season: [pickSpecificValue(specifics, ["Season"], "All Seasons")],
    Type: [pickSpecificValue(specifics, ["Type", "Product Type"], SEE_DESCRIPTION)],
    "Item Length": [
      pickSpecificValue(specifics, ["Item Length", "Length"], dims.length ?? SEE_DESCRIPTION),
    ],
    Fit: [pickSpecificValue(specifics, ["Fit"], "Regular")],
    "Size Type": [
      pickSpecificValue(specifics, ["Size Type"], detectSizeTypeFromText(title, description)),
    ],
    "Age Group": [
      pickSpecificValue(specifics, ["Age Group"], detectAgeGroupFromText(title, description)),
    ],
  };
}

export function filterAspectsForCategory(
  aspects: Record<string, string[]>,
  categoryAspectNames: string[],
): Record<string, string[]> {
  if (categoryAspectNames.length === 0) return aspects;

  const allowed = new Set(categoryAspectNames.map((name) => name.toLowerCase()));
  allowed.add("brand");
  allowed.add("mpn");

  const aliases: Record<string, string[]> = {
    color: ["colour"],
    colour: ["color"],
  };

  const filtered: Record<string, string[]> = {};
  for (const [name, values] of Object.entries(aspects)) {
    const nameLower = name.toLowerCase();
    if (allowed.has(nameLower)) {
      filtered[name] = values;
      continue;
    }
    const aliasList = aliases[nameLower] ?? [];
    if (aliasList.some((alias) => allowed.has(alias))) {
      filtered[name] = values;
    }
  }

  if (!filtered.Brand) filtered.Brand = [UNBRANDED];
  if (!filtered.MPN) filtered.MPN = [MPN_DOES_NOT_APPLY_EBAY];

  return filtered;
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
    Department: pickAiValue(
      ai,
      ["Department"],
      detectDepartmentFromText(product.title, product.description ?? undefined),
    ),
    "Size Type": pickAiValue(ai, ["Size Type"], detectSizeTypeFromText(product.title, product.description ?? undefined)),
    "Age Group": pickAiValue(ai, ["Age Group"], detectAgeGroupFromText(product.title, product.description ?? undefined)),
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
    department: ["department"],
    "size type": ["size type"],
    "age group": ["age group"],
  };

  const allowed = new Set(categoryAspectNames.map((name) => name.toLowerCase()));
  allowed.add("brand");
  allowed.add("mpn");

  const isClothingCategory = categoryAspectNames.some(
    (name) => name.toLowerCase() === "department",
  );
  if (isClothingCategory) {
    allowed.add("department");
    allowed.add("size type");
    allowed.add("age group");
  }

  return specifics.filter((specific) => {
    if (/^unknown$/i.test(specific.value)) return false;
    const nameLower = specific.name.toLowerCase();
    if (allowed.has(nameLower)) return true;
    const aliasList = aliases[nameLower] ?? [];
    return aliasList.some((alias) => allowed.has(alias));
  });
}

const CLOTHING_FIELD_ORDER = ["Department", "Size Type", "Age Group"];

export function sortClothingSpecificsFirst(
  specifics: GeneratedListingItemSpecific[],
  categoryAspectNames: string[],
): GeneratedListingItemSpecific[] {
  const isClothingCategory = categoryAspectNames.some(
    (name) => name.toLowerCase() === "department",
  );
  if (!isClothingCategory) return specifics;

  const clothing = specifics.filter((specific) =>
    CLOTHING_FIELD_ORDER.includes(specific.name),
  );
  const rest = specifics.filter((specific) => !CLOTHING_FIELD_ORDER.includes(specific.name));

  return [...clothing, ...rest];
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
