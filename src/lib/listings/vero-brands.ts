/** Well-known brands that trigger VeRO blocks when detected in listing content. */
export const BLOCKED_BRAND_NAMES = [
  "Nike",
  "Adidas",
  "Puma",
  "Reebok",
  "Under Armour",
  "New Balance",
  "Converse",
  "Vans",
  "Supreme",
  "Apple",
  "Samsung",
  "Sony",
  "LG",
  "Xiaomi",
  "Huawei",
  "Louis Vuitton",
  "Gucci",
  "Prada",
  "Chanel",
  "Ralph Lauren",
  "Tommy Hilfiger",
  "Calvin Klein",
  "Champion",
  "Lacoste",
  "The North Face",
  "Columbia",
  "Levi's",
  "Levis",
  "Wrangler",
  "Diesel",
  "Versace",
  "Armani",
  "Ray-Ban",
  "Ray Ban",
  "Oakley",
  "Rolex",
  "Casio",
  "Seiko",
  "PlayStation",
  "Xbox",
  "Nintendo",
  "Dyson",
  "Disney",
  "iPhone",
  "Beats",
  "Jordan",
  "Yeezy",
  "Balenciaga",
  "Burberry",
  "Hermès",
  "Hermes",
  "Fendi",
  "Dior",
  "Cartier",
  "Tiffany",
  "Coach",
  "Michael Kors",
  "North Face",
  "Patagonia",
  "Asics",
  "Skechers",
  "Fila",
  "Ugg",
  "Timberland",
  "Dr Martens",
  "Bose",
  "JBL",
  "Canon",
  "Nikon",
  "GoPro",
  "Fitbit",
  "Garmin",
  "Lego",
  "Barbie",
  "Hot Wheels",
  "Pokemon",
  "Marvel",
  "Star Wars",
] as const;

export const RESTRICTED_VERo_WORDS = [
  "replica",
  "1:1",
  "fake",
  "counterfeit",
  "oem copy",
  "knockoff",
  "copy brand",
  "inspired by",
  "dupe",
] as const;

/** Longest names first so "Louis Vuitton" matches before "Louis". */
const SORTED_BRANDS = [...BLOCKED_BRAND_NAMES].sort((a, b) => b.length - a.length);

function normalizeForBrandMatch(text: string): string {
  return text.toLowerCase().replace(/['']/g, "");
}

export function findBrandInText(text: string): string | null {
  if (!text.trim()) return null;
  const haystack = normalizeForBrandMatch(text);

  for (const brand of SORTED_BRANDS) {
    const needle = normalizeForBrandMatch(brand);
    if (haystack.includes(needle)) {
      return brand;
    }
  }

  return null;
}

export function findRestrictedWord(text: string): string | null {
  const haystack = text.toLowerCase();
  for (const word of RESTRICTED_VERo_WORDS) {
    if (haystack.includes(word)) {
      return word;
    }
  }
  return null;
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
