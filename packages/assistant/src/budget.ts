/**
 * Read a budget out of a shopper's message, in whole rupees.
 *
 *   "INR 1,00,000" -> 100000     "70k" -> 70000
 *   "1.2 lakh"     -> 120000     "16 GB RAM" -> null
 *
 * This runs in code and wins over whatever the model extracted. When a
 * message has several amounts ("between 50k and 70k") the highest is the
 * budget.
 */
export function parseBudget(message: string): number | null {
  const text = message.replace(/ /g, " ");
  const amounts: number[] = [];
  const add = (value: number) => {
    if (Number.isFinite(value) && value >= 500) amounts.push(Math.round(value));
  };
  const number = (raw: string) => Number(raw.replace(/,/g, ""));

  // 1 lakh, 1.2 lakh, 2 lacs
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*(?:lakhs?|lacs?)\b/gi)) {
    add(number(m[1] ?? "") * 100_000);
  }
  // 70k, 55.5K (the \b keeps "2 kg" out)
  for (const m of text.matchAll(/(\d+(?:\.\d+)?)\s*k\b/gi)) {
    add(number(m[1] ?? "") * 1_000);
  }
  // ₹55,000 / Rs. 55000 / INR 1,00,000
  for (const m of text.matchAll(/(?:₹|\brs\.?|\binr)\s*(\d[\d,]*(?:\.\d+)?)(?!\s*(?:k\b|lakh|lac))/gi)) {
    add(number(m[1] ?? ""));
  }
  // 55,000 rupees
  for (const m of text.matchAll(/(\d[\d,]*)\s*(?:rupees|\binr\b|\brs\b)/gi)) {
    add(number(m[1] ?? ""));
  }
  // under 70000 / budget of 55,000 / max 80000 (four digits or more)
  for (const m of text.matchAll(
    /\b(?:under|below|within|upto|up to|less than|not more than|budget(?:\s+(?:of|is))?|max(?:imum)?|around|about)\s*(?:of\s*)?(\d[\d,]{3,})(?!\s*(?:k\b|lakh|lac|gb|tb|hz|kg|mah))/gi,
  )) {
    add(number(m[1] ?? ""));
  }

  return amounts.length === 0 ? null : Math.max(...amounts);
}

/** 149990 -> "INR 1,49,990" (Indian digit grouping). */
export function formatInr(amount: number): string {
  return `INR ${amount.toLocaleString("en-IN")}`;
}
