import { describe, expect, test } from "bun:test";
import { formatInr, parseBudget } from "../src/budget";
import { AssistantResponseSchema } from "../src/contract";
import type { AssistantLlm } from "../src/llm";
import { maskSensitive } from "../src/privacy";
import { isGrounded, templateReason } from "../src/reasons";
import { runAssistant } from "../src/service";
import { enforceBudget, toolDefinitions } from "../src/tools";
import { CATEGORY_NAMES, deps, fakeTools, goodLlm, searchSeed } from "./fake-catalogue";

const EXAMPLES = {
  coding:
    "I need a laptop under INR 70,000 for coding and light video editing. Battery life matters; I travel a lot.",
  desktop: "Suggest a desktop for my home office under INR 60,000.",
  gaming: "Show me a gaming laptop under INR 1,00,000.",
  vague: "I need a good laptop.",
};

const air14 = () => searchSeed({ category: "Laptops" }).find((c) => c.productId === "LAP-101")!;

describe("response contract", () => {
  test("the four example requests all return a valid response", async () => {
    for (const message of Object.values(EXAMPLES)) {
      const response = await runAssistant({ message }, deps());
      expect(AssistantResponseSchema.safeParse(response).success).toBe(true);
    }
  });

  test("a malformed response is rejected", () => {
    const bad = {
      interpretedRequirement: "Laptop",
      budget: 70000,
      recommendations: [
        { productId: "LAP-101", productName: "NovaBook Air 14", reason: "Good", availability: "MAYBE", sku: "x", price: 64990, aboveBudget: false },
      ],
      clarifyingQuestion: null,
      message: null,
      mode: "ai",
    };
    expect(AssistantResponseSchema.safeParse(bad).success).toBe(false);
    expect(AssistantResponseSchema.safeParse({ ...bad, recommendations: [], extra: 1 }).success).toBe(false);
  });
});

describe("demo scenarios", () => {
  test("laptop under 70,000 for coding: up to 3 real laptops, all within budget, real specs", async () => {
    const response = await runAssistant({ message: EXAMPLES.coding }, deps());
    expect(response.budget).toBe(70000);
    expect(response.mode).toBe("ai");
    expect(response.clarifyingQuestion).toBeNull();
    expect(response.interpretedRequirement).toContain("Laptop for coding and video editing");
    expect(response.recommendations.length).toBeGreaterThan(0);
    expect(response.recommendations.length).toBeLessThanOrEqual(3);
    for (const rec of response.recommendations) {
      expect(rec.productId).toMatch(/^LAP-1/);
      expect(rec.price).toBeLessThanOrEqual(70000);
      expect(rec.aboveBudget).toBe(false);
      expect(rec.reason).toContain("GB RAM");
    }
    // Battery was the stated priority: the 18-hour Air 14 comes first.
    expect(response.recommendations[0]?.productId).toBe("LAP-101");
    expect(response.recommendations[0]?.reason).toStartWith("18 hr battery, 1.3 kg");
  });

  test("desktop for a home office under 60,000", async () => {
    const response = await runAssistant({ message: EXAMPLES.desktop }, deps());
    expect(response.budget).toBe(60000);
    expect(response.recommendations.map((r) => r.productId)).toContain("DSK-301");
    expect(response.recommendations.every((r) => r.price <= 60000)).toBe(true);
  });

  test("gaming laptop under 1 lakh: says nothing fits and shows the X17 as above budget", async () => {
    const tools = fakeTools();
    const response = await runAssistant({ message: EXAMPLES.gaming }, deps({ tools }));
    expect(response.budget).toBe(100000);
    expect(response.message).toBe(
      "Nothing in our catalogue matches a gaming laptop at or under INR 1,00,000. The closest option is shown below, marked as above budget. Would you like to raise your budget?",
    );
    expect(response.recommendations).toEqual([
      {
        productId: "LAP-201",
        productName: "Nova Gaming X17",
        reason:
          "AMD Ryzen 9, RTX 5070 graphics, 32 GB RAM, 1 TB SSD, 17.3-inch QHD 165 Hz display, 6 hr battery, 2.7 kg (INR 1,49,990, above budget)",
        availability: "IN_STOCK",
        sku: "LAP-201-R9-32-1TB-BLK",
        price: 149990,
        aboveBudget: true,
      },
    ]);
    // First search held the budget; only the second one dropped it.
    expect(tools.searches.map((s) => [s.maxPrice, s.ignoreBudget])).toEqual([
      [100000, false],
      [100000, true],
    ]);
  });

  test("'I need a good laptop': asks for budget and use, recommends nothing, searches nothing", async () => {
    const tools = fakeTools();
    const response = await runAssistant({ message: EXAMPLES.vague }, deps({ tools }));
    expect(response.recommendations).toEqual([]);
    expect(response.clarifyingQuestion).toBe(
      "To recommend the right product, could you tell me your budget and what you will mainly use the laptop for?",
    );
    expect(tools.searches).toHaveLength(0);
  });

  test("only the budget missing: asks for just that", async () => {
    const response = await runAssistant({ message: "I need a laptop for coding" }, deps());
    expect(response.clarifyingQuestion).toBe(
      "To recommend the right product, could you tell me your budget?",
    );
  });

  test("a spec the catalogue does not have: says so, invents nothing", async () => {
    const response = await runAssistant(
      { message: "laptop with 64 GB RAM under 50k for data science" },
      deps(),
    );
    expect(response.recommendations).toEqual([]);
    expect(response.message).toBe(
      "We don't have a laptop with at least 64 GB RAM in our catalogue, so there is nothing to recommend for this.",
    );
  });
});

describe("guardrails enforced in code", () => {
  test("budget: every recommendation is within budget unless marked above budget", async () => {
    for (const message of [EXAMPLES.coding, EXAMPLES.desktop, EXAMPLES.gaming, "monitor for photo editing under 25k", "laptop for study under 45k"]) {
      const response = await runAssistant({ message }, deps());
      for (const rec of response.recommendations) {
        expect(rec.aboveBudget || rec.price <= (response.budget ?? 0)).toBe(true);
      }
    }
  });

  test("a model that asks for a bigger budget in its tool call is overridden", () => {
    expect(enforceBudget({ category: "Laptops", maxPrice: 999999, ignoreBudget: true }, 70000)).toEqual({
      category: "Laptops",
      maxPrice: 70000,
      ignoreBudget: false,
    });
  });

  test("an invented product is dropped", async () => {
    const llm: AssistantLlm = {
      ...goodLlm(),
      async rank() {
        return {
          picks: [
            { productId: "LAP-999", reason: "A perfect laptop with 64 GB RAM." },
            { productId: "LAP-103", reason: null },
          ],
        };
      },
    };
    const response = await runAssistant({ message: EXAMPLES.coding }, deps({ llm }));
    const ids = response.recommendations.map((r) => r.productId);
    expect(ids).not.toContain("LAP-999");
    expect(ids[0]).toBe("LAP-103");
    expect(JSON.stringify(response)).not.toContain("64 GB");
  });

  test("only invented products: ranking falls back to rules", async () => {
    const llm: AssistantLlm = {
      ...goodLlm(),
      async rank() {
        return { picks: [{ productId: "LAP-999", reason: "Great." }] };
      },
    };
    const response = await runAssistant({ message: EXAMPLES.coding }, deps({ llm }));
    expect(response.mode).toBe("fallback");
    expect(response.recommendations[0]?.productId).toBe("LAP-101");
  });

  test("an invented spec in a reason is replaced with real specs", async () => {
    const llm: AssistantLlm = {
      ...goodLlm(),
      async rank() {
        return {
          picks: [
            { productId: "LAP-101", reason: "Great for travel with its 24 hr battery." },
            { productId: "LAP-103", reason: "16 GB RAM and a 512 GB SSD handle coding well." },
          ],
        };
      },
    };
    const response = await runAssistant({ message: EXAMPLES.coding }, deps({ llm }));
    const [first, second] = response.recommendations;
    expect(first?.reason).not.toContain("24 hr");
    expect(first?.reason).toContain("18 hr battery");
    // A reason whose numbers are all real is kept as written.
    expect(second?.reason).toBe("16 GB RAM and a 512 GB SSD handle coding well.");
  });

  test("grounding check: numbers and prices must match the product", () => {
    const candidate = air14();
    expect(isGrounded("18 hr battery and 1.3 kg, 16 GB RAM", candidate, 70000)).toBe(true);
    expect(isGrounded("A 14-inch screen at INR 64,990", candidate, 70000)).toBe(true);
    expect(isGrounded("24 hr battery", candidate, 70000)).toBe(false);
    expect(isGrounded("32 GB RAM", candidate, 70000)).toBe(false);
    expect(isGrounded("1 TB SSD", candidate, 70000)).toBe(false);
    expect(isGrounded("165 Hz display", candidate, 70000)).toBe(false);
    expect(isGrounded("Only INR 49,990", candidate, 70000)).toBe(false);
  });

  test("price, SKU and availability come from the catalogue, never from the model", async () => {
    const response = await runAssistant({ message: EXAMPLES.coding }, deps());
    for (const rec of response.recommendations) {
      const real = searchSeed({ category: "Laptops", maxPrice: 70000 }).find(
        (c) => c.productId === rec.productId,
      );
      expect([rec.price, rec.sku, rec.availability]).toEqual([real!.price, real!.sku, real!.availability]);
    }
  });

  test("an out-of-stock pick stays marked and is followed by an in-stock alternative", async () => {
    // Orbit View 24 is the only all-in-one under 60,000 and it is out of stock,
    // so use Laptops with the sold-out 8 GB Go 14 forced to the top instead.
    const llm: AssistantLlm = {
      ...goodLlm(),
      async rank(_request, candidates) {
        const out = candidates.filter((c) => c.availability === "OUT_OF_STOCK");
        const rest = candidates.filter((c) => c.availability !== "OUT_OF_STOCK");
        return { picks: [...out, ...rest].map((c) => ({ productId: c.productId, reason: null })) };
      },
    };
    const response = await runAssistant(
      { message: "all-in-one for home office under 60k" },
      deps({ llm }),
    );
    expect(response.recommendations.map((r) => r.availability)).toEqual(["OUT_OF_STOCK"]);

    const laptops = await runAssistant(
      { message: "laptop for study under 48k" },
      deps({
        llm: {
          ...goodLlm(),
          async rank() {
            return { picks: [{ productId: "LAP-103", reason: null }] };
          },
        },
      }),
    );
    expect(laptops.recommendations[0]).toMatchObject({ productId: "LAP-103", availability: "OUT_OF_STOCK" });
    expect(laptops.recommendations[1]?.availability).not.toBe("OUT_OF_STOCK");
  });

  test("personal data is masked before the model sees the message, and in the log", async () => {
    const llm = goodLlm();
    const d = deps({ llm });
    await runAssistant(
      { message: "I'm anita.rao@example.com, call 98765 43210, card 4111 1111 1111 1111. Laptop for coding under 70k" },
      d,
    );
    const sent = llm.seen.join(" ") + JSON.stringify(d.logs);
    expect(sent).not.toContain("anita.rao@example.com");
    expect(sent).not.toContain("98765");
    expect(sent).not.toContain("4111");
    expect(sent).toContain("[email]");
    expect(d.logs[0]).toMatchObject({ module: "AI-A", mode: "ai" });
    expect(d.logs[0]?.latency_ms).toBeGreaterThanOrEqual(0);
  });

  test("masking leaves prices and specs alone", () => {
    const text = "laptop under 100000 with 512 GB SSD, or INR 1,00,000, weight 1.3 kg";
    expect(maskSensitive(text)).toBe(text);
  });

  test("saved preferences fill gaps but never override what was just said", async () => {
    const preferences = { budget: 90000, useCase: "office work", brand: "Zenith" };
    const filled = await runAssistant({ message: "I need a laptop", preferences }, deps());
    expect(filled.budget).toBe(90000);
    expect(filled.clarifyingQuestion).toBeNull();
    expect(filled.interpretedRequirement).toContain("office work");
    expect(filled.recommendations.every((r) => r.productName.startsWith("Zenith"))).toBe(true);

    const stated = await runAssistant(
      { message: "I need a laptop for coding under 60k", preferences },
      deps(),
    );
    expect(stated.budget).toBe(60000);
    expect(stated.interpretedRequirement).toContain("coding");
  });

  test("tool definitions offer the real categories as an enum", () => {
    const [search] = toolDefinitions(CATEGORY_NAMES);
    expect(search.strict).toBe(true);
    expect(search.parameters.additionalProperties).toBe(false);
    expect(search.parameters.properties.category.enum).toEqual([...CATEGORY_NAMES, null]);
  });
});

describe("fallback: the endpoint never fails because of the model", () => {
  test("AI switched off: rule-based results, still within budget", async () => {
    const llm = goodLlm();
    const response = await runAssistant({ message: EXAMPLES.coding }, deps({ llm, aiEnabled: false }));
    expect(response.mode).toBe("fallback");
    expect(llm.seen).toHaveLength(0);
    expect(response.budget).toBe(70000);
    expect(response.recommendations.length).toBeGreaterThan(0);
    expect(response.recommendations.every((r) => r.price <= 70000)).toBe(true);
    expect(response.recommendations[0]?.productId).toBe("LAP-101");
  });

  test("AI switched off: the gaming and vague requests behave the same way", async () => {
    const gaming = await runAssistant({ message: EXAMPLES.gaming }, deps({ aiEnabled: false }));
    expect(gaming.recommendations[0]).toMatchObject({ productId: "LAP-201", aboveBudget: true });
    const vague = await runAssistant({ message: EXAMPLES.vague }, deps({ aiEnabled: false }));
    expect(vague.clarifyingQuestion).not.toBeNull();
  });

  test("model throws: falls back instead of failing", async () => {
    const llm: AssistantLlm = {
      async extract() {
        throw new Error("503 from provider");
      },
      async rank() {
        throw new Error("503 from provider");
      },
    };
    const response = await runAssistant({ message: EXAMPLES.desktop }, deps({ llm }));
    expect(response.mode).toBe("fallback");
    expect(response.recommendations.map((r) => r.productId)).toContain("DSK-301");
  });

  test("model too slow: falls back when the time budget runs out", async () => {
    const llm: AssistantLlm = {
      extract: () => new Promise((resolve) => setTimeout(() => resolve({}), 2000)),
      rank: () => new Promise((resolve) => setTimeout(() => resolve({}), 2000)),
    };
    const started = Date.now();
    const response = await runAssistant({ message: EXAMPLES.coding }, deps({ llm, timeoutMs: 100 }));
    expect(Date.now() - started).toBeLessThan(1500);
    expect(response.mode).toBe("fallback");
    expect(response.recommendations.length).toBeGreaterThan(0);
  });

  test("invalid model output is retried once with the error, then falls back", async () => {
    const feedback: (string | undefined)[] = [];
    const llm: AssistantLlm = {
      async extract(_message, _categories, error) {
        feedback.push(error);
        return { category: 42, nonsense: true };
      },
      async rank(request, candidates) {
        return goodLlm().rank(request, candidates);
      },
    };
    const response = await runAssistant({ message: EXAMPLES.coding }, deps({ llm }));
    expect(feedback).toHaveLength(2);
    expect(feedback[0]).toBeUndefined();
    expect(feedback[1]).toContain("category");
    expect(response.mode).toBe("fallback");
    expect(response.recommendations.length).toBeGreaterThan(0);
  });

  test("invalid output that is fixed on the retry is used", async () => {
    let calls = 0;
    const good = goodLlm();
    const llm: AssistantLlm = {
      async extract(message, categories) {
        return ++calls === 1 ? { wrong: true } : good.extract(message, categories);
      },
      rank: good.rank,
    };
    const response = await runAssistant({ message: EXAMPLES.coding }, deps({ llm }));
    expect(calls).toBe(2);
    expect(response.mode).toBe("ai");
  });

  test("a category the model made up is treated as not stated", async () => {
    const llm: AssistantLlm = {
      ...goodLlm(),
      async extract() {
        return { category: "Smartphones", budget: null, useCase: "calls", priorities: [] };
      },
    };
    const response = await runAssistant({ message: "phone for calls under 20k" }, deps({ llm }));
    expect(response.recommendations).toEqual([]);
    expect(response.clarifyingQuestion).toContain("what kind of product");
  });
});

describe("budget parsing", () => {
  test.each([
    ["INR 1,00,000", 100000],
    ["70k", 70000],
    ["1.2 lakh", 120000],
    ["₹55,000", 55000],
    ["under 1 lakh", 100000],
    ["Rs. 45000", 45000],
    ["budget of 80000", 80000],
    ["max 80000", 80000],
    ["between 50k and 70k", 70000],
    ["laptop under INR 70,000 with 16 GB RAM", 70000],
  ])("%s -> %i", (text, expected) => {
    expect(parseBudget(text)).toBe(expected);
  });

  test.each([["16 GB RAM"], ["a 2 kg laptop with 512 GB SSD"], ["I need a good laptop"], ["165 Hz screen, 18 hours battery"]])(
    "%s -> no budget",
    (text) => {
      expect(parseBudget(text)).toBeNull();
    },
  );

  test("the regex budget wins over the model's", async () => {
    const llm: AssistantLlm = {
      ...goodLlm(),
      async extract() {
        return { category: "Laptops", budget: 500000, useCase: "coding", priorities: [] };
      },
    };
    const response = await runAssistant({ message: "laptop for coding under 60k" }, deps({ llm }));
    expect(response.budget).toBe(60000);
    expect(response.recommendations.every((r) => r.price <= 60000)).toBe(true);
  });

  test("rupees are formatted with Indian grouping", () => {
    expect(formatInr(149990)).toBe("INR 1,49,990");
    expect(templateReason(air14(), 70000)).toBe(
      "Intel Core Ultra 5, 16 GB RAM, 512 GB SSD, 14-inch 2.2K display, 18 hr battery, 1.3 kg (INR 64,990, within budget)",
    );
  });
});

describe("wording", () => {
  test("the use case is tidied before it is shown", async () => {
    const llm: AssistantLlm = {
      ...goodLlm(),
      async extract() {
        return { category: "Laptops", budget: null, useCase: " for writing. ", priorities: [] };
      },
    };
    const response = await runAssistant({ message: "laptop for writing, max 80000" }, deps({ llm }));
    expect(response.interpretedRequirement).toBe("Laptop for writing");
  });

  test("a gaming laptop is not described as 'for gaming' twice", async () => {
    const response = await runAssistant({ message: "Show me a gaming laptop under INR 1,00,000." }, deps());
    expect(response.interpretedRequirement).toBe("Gaming laptop");
  });
});

describe("repeatable understanding", () => {
  test("a use or category the model misses is still picked up from explicit keywords", async () => {
    const llm: AssistantLlm = {
      ...goodLlm(),
      async extract() {
        return { category: null, budget: null, useCase: null, priorities: [] };
      },
    };
    const response = await runAssistant(
      { message: "Show me a gaming laptop under INR 1,00,000." },
      deps({ llm }),
    );
    expect(response.clarifyingQuestion).toBeNull();
    expect(response.recommendations[0]).toMatchObject({ productId: "LAP-201", aboveBudget: true });

    const vague = await runAssistant({ message: "I need a good laptop." }, deps({ llm }));
    expect(vague.clarifyingQuestion).toContain("your budget and what you will mainly use");
  });
});
