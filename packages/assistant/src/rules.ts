import type { Candidate } from "@repo/catalogue";
import { parseBudget } from "./budget";
import type { Extraction, Priority, Rank } from "./contract";
import { factsOf } from "./reasons";

/**
 * Rule-based understanding and ranking. Used for the numeric constraints in
 * every request, and for everything when the model is off, slow or wrong.
 */

/** Keyword patterns per category slug; first match wins, so Gaming is first. */
const CATEGORY_PATTERNS: [slug: string, pattern: RegExp][] = [
  ["gaming", /\bgaming\b|\bgamer\b/i],
  ["all-in-one", /\ball[- ]in[- ]one\b|\baio\b/i],
  ["add-ons", /\bwarranty\b|\bprotection plan\b|\bnovacare\b|\bcare plan\b/i],
  ["monitors", /\bmonitors?\b|\bexternal display\b/i],
  ["accessories", /\bmouse\b|\bmice\b|\bkeyboards?\b|\bdocks?\b|\bbackpacks?\b|\bbags?\b|\baccessor(?:y|ies)\b/i],
  ["laptops", /\blaptops?\b|\bnotebooks?\b|\bultrabooks?\b/i],
  ["desktops", /\bdesktops?\b|\btower\b|\bpc\b/i],
];

const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

/** Map a keyword match onto one of the categories that really exist. */
export function categoryFromKeywords(
  message: string,
  categories: string[],
): string | null {
  for (const [slug, pattern] of CATEGORY_PATTERNS) {
    if (!pattern.test(message)) continue;
    const real = categories.find((name) => slugOf(name) === slug);
    if (real) return real;
  }
  return null;
}

const USE_CASE_KEYWORDS: [label: string, pattern: RegExp][] = [
  ["coding", /\bcod(?:e|ing)\b|\bprogramming\b|\bdevelop(?:er|ment)\b/i],
  ["video editing", /\bvideo editing\b|\bediting videos?\b/i],
  ["photo editing", /\bphoto editing\b/i],
  ["design work", /\bdesign(?:ing)?\b/i],
  ["data science", /\bdata science\b|\bmachine learning\b/i],
  ["gaming", /\bgaming\b|\bgames?\b/i],
  ["home office", /\bhome office\b|\bwork(?:ing)? from home\b/i],
  ["office work", /\boffice\b|\bspreadsheets?\b|\bdocuments?\b/i],
  ["study", /\bstud(?:y|ies|ent|ying)\b|\bcollege\b|\bschool\b|\buniversity\b/i],
  ["browsing and streaming", /\bbrows(?:e|ing)\b|\bstreaming\b|\bmovies\b/i],
  ["writing", /\bwriting\b/i],
  ["travel", /\btravel(?:ling|ing|s)?\b/i],
];

/** What the product is for, from "for ..." or known keywords; null if unstated. */
export function useCaseFromKeywords(message: string): string | null {
  const labels: string[] = [];
  for (const [label, pattern] of USE_CASE_KEYWORDS) {
    if (!pattern.test(message)) continue;
    // "home office" already covers "office".
    if (label === "office work" && labels.includes("home office")) continue;
    labels.push(label);
  }
  // Travel alone says how it is carried, not what it is used for.
  const uses = labels.filter((label) => label !== "travel");
  if (uses.length > 0) return uses.join(" and ");

  const m = /\bfor\s+([^.,;!?]+)/i.exec(message);
  if (!m) return null;
  const phrase = (m[1] ?? "")
    .replace(/\b(?:under|below|within|upto|up to|less than|around|about|with|at|in|budget|max|priced)\b.*$/i, "")
    .trim();
  return phrase.length < 3 || /^(?:me|myself|us|you|sale)$/i.test(phrase) ? null : phrase;
}

const PRIORITY_PATTERNS: [Priority, RegExp][] = [
  ["battery", /\bbattery\b|\bbackup\b|\ball[- ]day\b/i],
  ["portability", /\btravel|\blight(?:weight)?\b|\bportable\b|\bcarry\b|\bcommut/i],
  ["performance", /\bperformance\b|\bfast\b|\bpowerful\b|\bvideo editing\b|\bdata science\b|\brendering\b/i],
  ["display", /\bscreen\b|\bdisplay\b|\boled\b/i],
];

export function prioritiesFromKeywords(message: string): Priority[] {
  return PRIORITY_PATTERNS.filter(([, pattern]) => pattern.test(message)).map(
    ([priority]) => priority,
  );
}

/** "16 GB RAM", "32GB memory" -> 16, 32. */
export function minRamFromText(message: string): number | null {
  const m =
    /(\d+)\s*gb\s*(?:of\s+)?(?:ram|memory)\b/i.exec(message) ??
    /\b(?:ram|memory)\s*(?:of\s+)?(\d+)\s*gb\b/i.exec(message);
  return m ? Number(m[1]) : null;
}

/** "512 GB SSD", "1 TB storage" -> 512, 1024. */
export function minStorageFromText(message: string): number | null {
  const m =
    /(\d+)\s*(gb|tb)\s*(?:of\s+)?(?:ssd|hdd|storage|disk|drive)\b/i.exec(message) ??
    /\b(?:ssd|storage)\s*(?:of\s+)?(\d+)\s*(gb|tb)\b/i.exec(message);
  if (!m) return null;
  return Number(m[1]) * ((m[2] ?? "").toLowerCase() === "tb" ? 1024 : 1);
}

/** "under 1.5 kg", "lighter than 2kg" -> 1.5, 2. */
export function maxWeightFromText(message: string): number | null {
  const m =
    /\b(?:under|below|less than|lighter than|max(?:imum)?|within|upto|up to)\s*(\d+(?:\.\d+)?)\s*kg\b/i.exec(
      message,
    );
  return m ? Number(m[1]) : null;
}

/** A brand counts only if it is one the catalogue sells. */
export function brandFromText(message: string, brands: string[]): string | null {
  return (
    brands.find((brand) =>
      new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(message),
    ) ?? null
  );
}

/** The parts of a request that are read by rules in every mode. */
export function numericConstraints(message: string, brands: string[]) {
  return {
    budget: parseBudget(message),
    minRamGb: minRamFromText(message),
    minStorageGb: minStorageFromText(message),
    maxWeightKg: maxWeightFromText(message),
    brand: brandFromText(message, brands),
  };
}

/** Step 8: understand the whole request without the model. */
export function extractByRules(
  message: string,
  categories: string[],
  brands: string[],
): Extraction {
  return {
    category: categoryFromKeywords(message, categories),
    useCase: useCaseFromKeywords(message),
    priorities: prioritiesFromKeywords(message),
    ...numericConstraints(message, brands),
  };
}

/**
 * Step 8: rank without the model. In-stock first, then what the shopper said
 * matters (longer battery, lower weight, more RAM, bigger screen), then
 * rating, then price.
 */
export function rankByRules(candidates: Candidate[], priorities: Priority[]): Rank {
  const inStock = (c: Candidate) => (c.availability === "OUT_OF_STOCK" ? 1 : 0);
  const score = (c: Candidate, priority: Priority): number => {
    const facts = factsOf(c);
    if (priority === "battery") return facts.batteryHrs ?? 0;
    if (priority === "portability") return -(facts.weightKg ?? 99);
    if (priority === "performance") return facts.ramGb ?? 0;
    return facts.screenIn ?? 0;
  };
  const sorted = [...candidates].sort((a, b) => {
    const stock = inStock(a) - inStock(b);
    if (stock !== 0) return stock;
    for (const priority of priorities) {
      const diff = score(b, priority) - score(a, priority);
      if (diff !== 0) return diff;
    }
    return b.rating - a.rating || a.price - b.price;
  });
  return { picks: sorted.map((c) => ({ productId: c.productId, reason: null })) };
}
