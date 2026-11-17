import type { Candidate } from "@repo/catalogue";
import { formatInr } from "./budget";
import type { Priority } from "./contract";

/** The real, checkable facts about a candidate (its chosen variant first). */
export function factsOf(candidate: Candidate) {
  const { specs, variant } = candidate;
  return {
    processor: variant.processor ?? specs.processor,
    ramGb: variant.ramGb ?? specs.ramGb,
    storageGb: variant.storageGb ?? specs.storageGb,
    storageType: specs.storageType,
    screen: specs.screen,
    screenIn: specs.screenIn,
    refreshHz: specs.refreshHz,
    gpu: specs.gpu,
    batteryHrs: specs.batteryHrs,
    weightKg: specs.weightKg,
  };
}

function storageLabel(gb: number): string {
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;
}

/**
 * A reason written by code from catalogue data only, for example
 * "Intel Core Ultra 5, 16 GB RAM, 512 GB SSD, 18 hr battery, 1.3 kg
 * (INR 64,990, within budget)". What the shopper said matters most comes
 * first.
 */
export function templateReason(
  candidate: Candidate,
  budget: number | null,
  priorities: Priority[] = [],
): string {
  const facts = factsOf(candidate);
  const parts: { key: string; text: string }[] = [];
  if (facts.processor) parts.push({ key: "processor", text: facts.processor });
  if (facts.gpu && !/^integrated$/i.test(facts.gpu)) {
    parts.push({ key: "gpu", text: `${facts.gpu} graphics` });
  }
  if (facts.ramGb) parts.push({ key: "ram", text: `${facts.ramGb} GB RAM` });
  if (facts.storageGb) {
    parts.push({
      key: "storage",
      text: `${storageLabel(facts.storageGb)} ${facts.storageType ?? "storage"}`,
    });
  }
  if (facts.screen) {
    const hz =
      facts.refreshHz && facts.refreshHz > 60 && !/hz/i.test(facts.screen)
        ? ` ${facts.refreshHz} Hz`
        : "";
    // "24-inch FHD monitor included" already says what it is.
    const noun = /monitor|display/i.test(facts.screen) ? "" : " display";
    parts.push({ key: "screen", text: `${facts.screen}${hz}${noun}` });
  }
  if (facts.batteryHrs) parts.push({ key: "battery", text: `${facts.batteryHrs} hr battery` });
  if (facts.weightKg) parts.push({ key: "weight", text: `${facts.weightKg} kg` });

  const first: Record<Priority, string[]> = {
    battery: ["battery"],
    portability: ["weight"],
    performance: ["processor", "gpu", "ram"],
    display: ["screen"],
  };
  const lead = priorities.flatMap((priority) => first[priority]);
  const rank = (key: string) => {
    const at = lead.indexOf(key);
    return at === -1 ? lead.length : at;
  };
  const ordered = parts
    .map((part, index) => ({ ...part, index }))
    .sort((a, b) => rank(a.key) - rank(b.key) || a.index - b.index)
    .map((part) => part.text);

  const summary =
    ordered.length > 0
      ? ordered.join(", ")
      : `${candidate.brand} ${candidate.productName}`;
  const price = formatInr(candidate.price);
  const fit =
    budget === null
      ? price
      : candidate.price > budget
        ? `${price}, above budget`
        : `${price}, within budget`;
  return `${summary} (${fit})`;
}

const close = (a: number, b: number | null | undefined) =>
  b !== null && b !== undefined && Math.abs(a - b) < 0.051;

/**
 * Grounding check for a reason the model wrote: every number with a unit
 * (GB, TB, hr, kg, Hz, inch) and every rupee amount must match this
 * product's real data. One mismatch and the reason is not used.
 */
export function isGrounded(
  reason: string,
  candidate: Candidate,
  budget: number | null,
): boolean {
  const facts = factsOf(candidate);
  const { specs } = candidate;

  for (const m of reason.matchAll(
    /(\d+(?:\.\d+)?)\s*-?\s*(gb|tb|hrs?|hours?|kg|hz|inch(?:es)?|")/gi,
  )) {
    const value = Number(m[1]);
    const unit = (m[2] ?? "").toLowerCase();
    let ok: boolean;
    if (unit === "gb" || unit === "tb") {
      const gb = unit === "tb" ? value * 1024 : value;
      ok = [facts.ramGb, facts.storageGb, specs.ramGb, specs.storageGb].some((real) =>
        close(gb, real),
      );
    } else if (unit.startsWith("h") && unit !== "hz") {
      ok = close(value, facts.batteryHrs);
    } else if (unit === "kg") {
      ok = close(value, facts.weightKg);
    } else if (unit === "hz") {
      ok = close(value, facts.refreshHz);
    } else {
      ok = close(value, facts.screenIn);
    }
    if (!ok) return false;
  }

  for (const m of reason.matchAll(/(?:₹|\brs\.?|\binr)\s*(\d[\d,]*)/gi)) {
    const amount = Number((m[1] ?? "").replace(/,/g, ""));
    if (![candidate.price, candidate.mrp, budget].includes(amount)) return false;
  }
  return true;
}
