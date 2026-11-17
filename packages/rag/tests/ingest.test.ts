import path from "node:path";
import { describe, expect, test } from "bun:test";
import { chunkDocument } from "../src/ingest/chunker";
import { loadKnowledgeDir, parseMarkdown } from "../src/ingest/loaders";

const knowledgeDir = path.resolve(import.meta.dir, "../data/knowledge");

const FRONT_MATTER = `---
title: Test Policy
docType: Policy
version: "1.0"
effectiveDate: 2026-01-01
region: India
productCategory: Laptop
audience: Customer
tier: All
---
`;

describe("parseMarkdown", () => {
  test("reads metadata and splits by heading", () => {
    const doc = parseMarkdown(
      `${FRONT_MATTER}\n# Test Policy\n\nIntro line.\n\n## First\n\nAlpha.\n\n## Second\n\nBeta.\n`,
      "test.md",
    );
    expect(doc.metadata.version).toBe("1.0");
    expect(doc.metadata.effectiveDate).toBe("2026-01-01");
    expect(doc.sections).toEqual([
      { heading: "Overview", text: "Intro line." },
      { heading: "First", text: "Alpha." },
      { heading: "Second", text: "Beta." },
    ]);
  });

  test("rejects a document without valid metadata", () => {
    expect(() => parseMarkdown("# No front matter\n", "bad.md")).toThrow(/front matter/);
    expect(() =>
      parseMarkdown(FRONT_MATTER.replace("audience: Customer", "audience: Everyone"), "bad.md"),
    ).toThrow(/audience/);
  });
});

describe("chunkDocument", () => {
  test("every chunk keeps its section heading, also when a section is split", async () => {
    const long = Array.from({ length: 60 }, (_, i) => `Sentence number ${i} of the long section.`).join(" ");
    const doc = parseMarkdown(`${FRONT_MATTER}\n## Short\n\nAlpha.\n\n## Long\n\n${long}\n`, "test.md");
    const chunks = await chunkDocument(doc);

    expect(chunks[0]?.metadata.section).toBe("Short");
    expect(chunks[0]?.pageContent).toBe("Test Policy — Short\nAlpha.");
    const longChunks = chunks.filter((c) => c.metadata.section === "Long");
    expect(longChunks.length).toBeGreaterThan(1);
    for (const c of longChunks) {
      expect(c.pageContent.startsWith("Test Policy — Long\n")).toBe(true);
      expect(c.metadata.documentId).toBe("test.md@1.0");
    }
  });
});

describe("seed knowledge base", () => {
  test("loads all eight documents, Markdown and PDF, with their sections", async () => {
    const docs = await loadKnowledgeDir(knowledgeDir);
    expect(docs.map((d) => d.metadata.title).sort()).toEqual([
      "Coupon & Offer Terms",
      "Laptop & Desktop Return Policy",
      "NovaBook Air 14 User Guide",
      "NovaClub Membership Benefits",
      "Refund Policy",
      "Shipping & Delivery Policy",
      "Store Operations Procedure",
      "Warranty Policy",
    ]);

    const guide = docs.find((d) => d.sourceFile.endsWith(".pdf"));
    expect(guide?.sections.map((s) => s.heading)).toEqual([
      "Getting started",
      "Battery",
      "Force restart",
      "Reset this PC",
      "Ports",
      "Care",
    ]);
    expect(guide?.sections.find((s) => s.heading === "Force restart")?.text).toContain(
      "holding the power button for 15 seconds",
    );

    const staff = docs.filter((d) => d.metadata.audience === "Staff");
    expect(staff.map((d) => d.metadata.title)).toEqual(["Store Operations Procedure"]);
  });
});
