/**
 * Builds the NovaBook Air 14 User Guide as a PDF, so the knowledge base has a
 * real PDF to ingest next to the Markdown policies.
 *
 *   bun run generate:pdf
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts, type PDFFont } from "pdf-lib";

const here = path.dirname(fileURLToPath(import.meta.url));
const outFile = path.resolve(
  here,
  "../data/knowledge/novabook-air-14-user-guide.pdf",
);

const TITLE = "NovaBook Air 14 User Guide";

const SECTIONS: { heading: string; paragraphs: string[] }[] = [
  {
    heading: "Getting started",
    paragraphs: [
      "Connect the charger to either USB-C port and press the power button once to turn on the NovaBook Air 14. Follow the on-screen setup to choose a language, connect to Wi-Fi and sign in.",
    ],
  },
  {
    heading: "Battery",
    paragraphs: [
      "The NovaBook Air 14 battery lasts up to 18 hours of video playback on a full charge. Battery life depends on screen brightness and the apps in use.",
      "The laptop charges through either USB-C port with the charger supplied in the box.",
    ],
  },
  {
    heading: "Force restart",
    paragraphs: [
      "If the NovaBook Air 14 stops responding, force a restart by holding the power button for 15 seconds. Release the button, then press it once to turn the laptop back on.",
    ],
  },
  {
    heading: "Reset this PC",
    paragraphs: [
      "To reset the NovaBook Air 14, open Settings, choose Recovery and select Reset this PC. You can keep your files or remove everything. Back up your files before a reset that removes everything.",
    ],
  },
  {
    heading: "Ports",
    paragraphs: [
      "The NovaBook Air 14 has two USB-C ports and one HDMI port. Both USB-C ports support charging and data. The HDMI port connects an external monitor or projector.",
      "This guide does not include a dock compatibility list.",
    ],
  },
  {
    heading: "Care",
    paragraphs: [
      "Clean the screen with a soft dry cloth. Keep liquids away from the keyboard and the ports. Do not cover the air vents on the underside while the laptop is in use.",
    ],
  },
];

const PAGE = { width: 595, height: 842, margin: 64 };
const SIZES = { title: 22, heading: 15, body: 11 };

function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(candidate, size) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const pdf = await PDFDocument.create();
pdf.setTitle(TITLE);
const regular = await pdf.embedFont(StandardFonts.Helvetica);
const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
const maxWidth = PAGE.width - PAGE.margin * 2;

let page = pdf.addPage([PAGE.width, PAGE.height]);
let y = PAGE.height - PAGE.margin;

function draw(text: string, font: PDFFont, size: number, gapAfter: number) {
  for (const line of wrap(text, font, size, maxWidth)) {
    if (y < PAGE.margin + size) {
      page = pdf.addPage([PAGE.width, PAGE.height]);
      y = PAGE.height - PAGE.margin;
    }
    page.drawText(line, { x: PAGE.margin, y, font, size });
    y -= size * 1.45;
  }
  y -= gapAfter;
}

draw(TITLE, bold, SIZES.title, 14);
for (const section of SECTIONS) {
  draw(section.heading, bold, SIZES.heading, 4);
  for (const paragraph of section.paragraphs) {
    draw(paragraph, regular, SIZES.body, 8);
  }
  y -= 8;
}

await Bun.write(outFile, await pdf.save());
console.log(`Wrote ${outFile}`);
