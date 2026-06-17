// ═══════════════════════════════════════════════════════════════════════════════
//  Brand / colour / model normalization — shared by the ai-picker routes.
//  Pure data + pure functions, no prompt text. Extracted from route.ts so the
//  chat route and the regex fallback share one source of truth (and so the
//  suggest route can adopt the same aliases later).
// ═══════════════════════════════════════════════════════════════════════════════

export const COLOR_ALIASES: Record<string, string> = {
  "чорний": "Black", "чорна": "Black", "черный": "Black", "black": "Black",
  "білий": "White", "біла": "White", "белый": "White", "white": "White",
  "сірий": "Grey", "сіра": "Grey", "серый": "Grey", "grey": "Grey", "gray": "Grey",
  "синій": "Blue", "синя": "Blue", "синий": "Blue", "blue": "Blue",
  "червоний": "Red", "червона": "Red", "красный": "Red", "red": "Red",
  "зелений": "Green", "зелена": "Green", "зеленый": "Green", "green": "Green",
  "коричневий": "Brown", "коричнева": "Brown", "brown": "Brown",
  "бежевий": "Beige", "бежева": "Beige", "beige": "Beige",
  "сріблястий": "Silver", "срібний": "Silver", "silver": "Silver",
  "помаранчевий": "Orange", "оранжевый": "Orange", "orange": "Orange",
  "жовтий": "Yellow", "жовта": "Yellow", "yellow": "Yellow",
}

// alias → ONE canonical brand. Concern/group terms ("ВАГ") do NOT belong here —
// they expand to several brands and live in BRAND_GROUPS below.
export const BRAND_ALIASES: Record<string, string> = {
  "вольксваген": "Volkswagen", "фольксваген": "Volkswagen", "фольк": "Volkswagen",
  "vw": "Volkswagen",
  "бмв": "BMW", "бэмвэ": "BMW",
  "мерс": "Mercedes-Benz", "мерседес": "Mercedes-Benz", "мерсик": "Mercedes-Benz",
  "ауді": "Audi", "ауди": "Audi",
  "тойота": "Toyota", "шкода": "Skoda", "škoda": "Skoda",
  "вольво": "Volvo", "кіа": "Kia", "кия": "Kia",
  "хюндай": "Hyundai", "хундай": "Hyundai", "хендай": "Hyundai",
  "форд": "Ford", "пежо": "Peugeot", "рено": "Renault",
  "опель": "Opel", "порше": "Porsche", "тесла": "Tesla",
  "лексус": "Lexus", "субару": "Subaru", "мазда": "Mazda",
  "нісан": "Nissan", "ніссан": "Nissan", "альфа": "Alfa Romeo",
  "ситроен": "Citroen", "сітроен": "Citroen",
  // Premium & exotic — Cyrillic aliases
  "астон": "Aston Martin", "астон мартін": "Aston Martin", "астон мартин": "Aston Martin",
  "бентлі": "Bentley", "бентли": "Bentley",
  "феррарі": "Ferrari", "феррари": "Ferrari",
  "ламборгіні": "Lamborghini", "ламборгини": "Lamborghini", "ламбо": "Lamborghini",
  "мазераті": "Maserati", "мазерати": "Maserati",
  "роллс-ройс": "Rolls-Royce", "роллс ройс": "Rolls-Royce", "ролс": "Rolls-Royce",
  "інфініті": "Infiniti", "инфинити": "Infiniti", "інфініти": "Infiniti",
  "акура": "Acura",
  "смарт": "Smart",
  "абарт": "Abarth",
  "альпін": "Alpine", "альпин": "Alpine",
  "купра": "Cupra",
  "ленд ровер": "Land Rover", "ленд-ровер": "Land Rover", "ровер": "Land Rover",
  "ягуар": "Jaguar",
  "мітсубісі": "Mitsubishi", "мицубиси": "Mitsubishi", "мітсу": "Mitsubishi",
  "сузукі": "Suzuki", "сузуки": "Suzuki",
  "дачія": "Dacia", "дачия": "Dacia",
  "фіат": "Fiat", "фиат": "Fiat",
  "дженезіс": "Genesis", "дженезис": "Genesis",
  "крайслер": "Chrysler",
  "додж": "Dodge",
  "сеат": "SEAT", "сіат": "SEAT",
  "сааб": "Saab",
  "хонда": "Honda",
  "міні": "MINI", "мини": "MINI",
  "джип": "Jeep",
  "дс": "DS Automobiles", "ds": "DS Automobiles",
}

// ── Canonical known brands — THE single source of truth ──────────────────────
// Both the Claude-path validator (`_KNOWN` in route.ts) and the regex fallback
// (`KNOWN_BRANDS` in regexFallbackExtract) derive from this list. Adding a brand
// here propagates everywhere — no more manual sync drift between the two paths
// and the parser. Canonical spelling only (matches normalizeBrand output).
export const KNOWN_BRANDS: readonly string[] = [
  "BMW", "Audi", "Mercedes-Benz", "Volkswagen", "Volvo", "Toyota",
  "Honda", "Mazda", "Skoda", "SEAT", "Cupra", "Ford", "Opel",
  "Peugeot", "Renault", "Citroen", "Hyundai", "Kia", "Nissan",
  "Mitsubishi", "Subaru", "Lexus", "Porsche", "Tesla", "MINI",
  "Jeep", "Land Rover", "Jaguar", "Alfa Romeo", "Saab", "Suzuki",
  "Dacia", "Fiat", "Genesis", "Chrysler", "Dodge",
  // Premium / exotic
  "Aston Martin", "Bentley", "Ferrari", "Lamborghini", "Maserati",
  "Rolls-Royce", "Infiniti", "Acura", "Smart", "Abarth", "Alpine",
  "DS Automobiles",
] as const

// Canonical-name lookup for hallucination guards (Claude path).
export const KNOWN_BRAND_SET: ReadonlySet<string> = new Set(KNOWN_BRANDS)

// Lowercase spellings for substring detection in free text (regex fallback).
// Longest-first so "mercedes-benz" wins over "mercedes" and "land rover" over a
// stray "rover". Includes a couple of short colloquial spellings the canonical
// list lacks ("vw", "mercedes"); these map back via normalizeBrand downstream.
export const KNOWN_BRANDS_LOWER: readonly string[] = [
  ...KNOWN_BRANDS.map(b => b.toLowerCase()),
  "vw", "mercedes",
].sort((a, b) => b.length - a.length)

// ── Multi-brand concern terms ────────────────────────────────────────────────
// Unlike BRAND_ALIASES (one canonical brand per key), a concern term expands
// into SEVERAL brands so "ВАГ" searches the WHOLE group, not just Volkswagen.
// Passenger-car brands only: the picker caps each search at 8 brand/model pairs,
// and the concern's motorcycle (Ducati) / commercial (MAN, Scania) marques are
// a different vehicle_type. Add other concerns (BMW Group, Stellantis…) here.
const VAG_BRANDS = [
  "Volkswagen", "Audi", "Porsche", "Skoda", "SEAT", "Cupra", "Bentley", "Lamborghini",
]

export const BRAND_GROUPS: Record<string, string[]> = {
  "ваг": VAG_BRANDS, "ваг група": VAG_BRANDS, "ваг груп": VAG_BRANDS,
  "vag": VAG_BRANDS, "vw group": VAG_BRANDS, "vw група": VAG_BRANDS,
  "концерн vw": VAG_BRANDS, "концерн ваг": VAG_BRANDS,
}

// Letters/digits that count as "inside a word" for boundary checks. Plain \b is
// unreliable for Cyrillic in JS, so we guard the term manually so "ваг" matches
// "хочу ваг до 30к" but NOT "вагон" / "важіль".
const WORD_CHAR = "a-z0-9а-яіїєґё'"

// Find any concern term in free text → its canonical brand list (deduplicated).
// Longest key first so "ваг група" wins over the substring "ваг". [] if none.
export function detectBrandGroups(text: string): string[] {
  const lower = (text || "").toLowerCase()
  const keys = Object.keys(BRAND_GROUPS).sort((a, b) => b.length - a.length)
  for (const k of keys) {
    const esc = k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    const re = new RegExp(`(^|[^${WORD_CHAR}])${esc}([^${WORD_CHAR}]|$)`, "i")
    if (re.test(lower)) return Array.from(new Set(BRAND_GROUPS[k]))
  }
  return []
}

export function normalizeBrand(raw: string): string {
  const key = raw.trim().toLowerCase()
  return BRAND_ALIASES[key] ?? raw.trim()
}

// Strip trailing generation markers from model slugs so AS24/mobile.de
// receive valid paths. AI sometimes returns "passat b9" / "x5 g05" / "a4 b9"
// instead of the base model — AS24 has no /volkswagen/passat-b9 page, so the
// whole search returns 0 even though /volkswagen/passat is the correct URL.
// Matches: B9, W213, F30, G05, C8, E46 — letter + 1-3 digits at the end of
// the model, separated by space or hyphen. Single-word models are unchanged.
//
// Exception: AMG/M/RS performance trims look the same syntactically (e63, m5)
// but are model variants, not generation codes — preserve them when the prefix
// is a performance label or empty.
export function stripGenerationSuffix(model: string | null | undefined): string | null {
  if (!model) return model ?? null
  const trimmed = model.trim()
  // Body-type suffix: "Cooper 3 Door" / "C3 5-Door" — AI sometimes tacks the
  // body variant onto the model name. Parser then asks AS24 for /mini/3-door
  // (404). Strip the suffix; downstream body_type filter still narrows.
  const noBody = trimmed.replace(/[\s-]+[35][\s-]?door[s]?$/i, "").trim() || trimmed
  const match = noBody.match(/^(.*?)[\s-]+[bwfgce]\d{1,3}$/i)
  if (!match) return noBody
  const base = match[1].trim()
  // Performance prefixes — "amg e63", "m e63" etc. keep the full string.
  if (/^(amg|m|rs|s|gt)$/i.test(base)) return noBody
  return base || noBody
}

export function normalizeColor(text: string): string | null {
  const words = text.toLowerCase().split(/\s+/)
  for (const word of words) {
    if (COLOR_ALIASES[word]) return COLOR_ALIASES[word]
  }
  return null
}
