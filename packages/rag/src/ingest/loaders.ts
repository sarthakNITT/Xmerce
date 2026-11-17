import path from "node:path";
import { readdir } from "node:fs/promises";
import { YAML } from "bun";
import { getDocumentProxy } from "unpdf";
import {
  DocumentMetadataSchema,
  type DocumentMetadata,
  type DocumentSection,
  type LoadedDocument,
} from "../types";

function parseMetadata(raw: unknown, sourceFile: string): DocumentMetadata {
  // YAML turns an unquoted date into a Date; the schema wants YYYY-MM-DD.
  const input =
    raw && typeof raw === "object"
      ? Object.fromEntries(
          Object.entries(raw).map(([key, value]) => [
            key,
            value instanceof Date ? value.toISOString().slice(0, 10) : value,
          ]),
        )
      : raw;
  const parsed = DocumentMetadataSchema.safeParse(input);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid metadata for ${sourceFile}: ${problems}`);
  }
  return parsed.data;
}

/**
 * Markdown: metadata in YAML front matter, one section per heading.
 * The `# Title` line is skipped; text before the first `##` goes under
 * "Overview".
 */
export function parseMarkdown(source: string, sourceFile: string): LoadedDocument {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source);
  if (!match) {
    throw new Error(`${sourceFile} has no front matter with document metadata`);
  }
  const metadata = parseMetadata(YAML.parse(match[1] ?? ""), sourceFile);
  const body = source.slice(match[0].length);

  const sections: DocumentSection[] = [];
  let heading = "Overview";
  let lines: string[] = [];
  const flush = () => {
    const text = lines.join("\n").trim();
    if (text) sections.push({ heading, text });
    lines = [];
  };
  for (const line of body.split(/\r?\n/)) {
    const h = /^(#{1,6})\s+(.+?)\s*#*$/.exec(line);
    if (!h) {
      lines.push(line);
    } else if ((h[1] ?? "").length > 1) {
      flush();
      heading = (h[2] ?? "").trim();
    }
  }
  flush();
  return { sourceFile, metadata, sections };
}

interface PdfLine {
  text: string;
  /** Font height of the line; headings are set larger than body text. */
  height: number;
}

interface PdfTextItem {
  str: string;
  height: number;
  transform: number[];
}

function isTextItem(item: unknown): item is PdfTextItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "str" in item &&
    "transform" in item
  );
}

async function readPdfLines(data: Uint8Array): Promise<PdfLine[]> {
  const pdf = await getDocumentProxy(data);
  const lines: PdfLine[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    let currentY: number | undefined;
    let current: PdfLine | undefined;
    for (const item of content.items) {
      if (!isTextItem(item) || item.str.trim() === "") continue;
      const y = item.transform[5] ?? 0;
      if (current && currentY !== undefined && Math.abs(y - currentY) < 2) {
        current.text += item.str;
        current.height = Math.max(current.height, item.height);
      } else {
        current = { text: item.str, height: item.height };
        lines.push(current);
        currentY = y;
      }
    }
  }
  return lines.map((line) => ({ ...line, text: line.text.trim() }));
}

/**
 * PDF: metadata comes from a sidecar `<name>.meta.json`. Headings are the
 * lines set in a larger font than the body text; the largest is the title.
 */
export async function parsePdf(
  data: Uint8Array,
  rawMetadata: unknown,
  sourceFile: string,
): Promise<LoadedDocument> {
  const metadata = parseMetadata(rawMetadata, sourceFile);
  const lines = await readPdfLines(data);

  // Body size = the font height that carries the most text.
  const weight = new Map<number, number>();
  for (const line of lines) {
    const key = Math.round(line.height * 10) / 10;
    weight.set(key, (weight.get(key) ?? 0) + line.text.length);
  }
  const bodyHeight = [...weight.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 0;
  const titleHeight = Math.max(...lines.map((line) => line.height), 0);
  const headingThreshold = bodyHeight * 1.15;

  const sections: DocumentSection[] = [];
  let heading = "Overview";
  let paragraph: string[] = [];
  const flush = () => {
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) sections.push({ heading, text });
    paragraph = [];
  };
  for (const line of lines) {
    if (line.height <= headingThreshold) {
      paragraph.push(line.text);
    } else if (line.height < titleHeight || titleHeight === bodyHeight) {
      flush();
      heading = line.text;
    }
    // A line at title size is the document title: not a section.
  }
  flush();
  return { sourceFile, metadata, sections };
}

/** Load every approved document in a folder. */
export async function loadKnowledgeDir(dir: string): Promise<LoadedDocument[]> {
  const files = (await readdir(dir)).sort();
  const documents: LoadedDocument[] = [];
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const extension = path.extname(file).toLowerCase();
    if (extension === ".md") {
      documents.push(parseMarkdown(await Bun.file(fullPath).text(), file));
    } else if (extension === ".pdf") {
      const metaPath = fullPath.replace(/\.pdf$/i, ".meta.json");
      const metaFile = Bun.file(metaPath);
      if (!(await metaFile.exists())) {
        throw new Error(
          `${file} needs a metadata file next to it: ${path.basename(metaPath)}`,
        );
      }
      documents.push(
        await parsePdf(
          new Uint8Array(await Bun.file(fullPath).arrayBuffer()),
          await metaFile.json(),
          file,
        ),
      );
    }
  }
  return documents;
}
