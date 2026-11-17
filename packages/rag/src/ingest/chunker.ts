import { Document } from "@langchain/core/documents";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { config } from "../config";
import type { ChunkMetadata, LoadedDocument } from "../types";

export function documentId(doc: LoadedDocument): string {
  return `${doc.sourceFile}@${doc.metadata.version}`;
}

/**
 * One chunk per section, so every chunk keeps its heading (NS-I2). A section
 * longer than `chunkSize` is split further; each piece keeps the same heading.
 *
 * The stored text starts with "<document title> — <section heading>" so the
 * embedding carries the heading as well as the body.
 */
export async function chunkDocument(
  doc: LoadedDocument,
): Promise<Document<ChunkMetadata>[]> {
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
  });
  const chunks: Document<ChunkMetadata>[] = [];
  for (const section of doc.sections) {
    const prefix = `${doc.metadata.title} — ${section.heading}\n`;
    for (const piece of await splitter.splitText(section.text)) {
      chunks.push(
        new Document<ChunkMetadata>({
          pageContent: prefix + piece,
          metadata: {
            ...doc.metadata,
            documentId: documentId(doc),
            sourceFile: doc.sourceFile,
            section: section.heading,
            chunkIndex: chunks.length,
          },
        }),
      );
    }
  }
  return chunks;
}
