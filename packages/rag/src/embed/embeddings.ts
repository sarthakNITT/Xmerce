import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { config } from "../config";

/**
 * bge models expect this instruction in front of a *question*; document
 * chunks are embedded as-is.
 */
const QUERY_INSTRUCTION =
  "Represent this sentence for searching relevant passages: ";

/**
 * Local embedding model: runs in-process through ONNX, so it needs no API key
 * and sends no text to an outside service. Vectors are normalised, so cosine
 * similarity is a plain dot product.
 */
class BgeEmbeddings extends HuggingFaceTransformersEmbeddings {
  override embedQuery(text: string): Promise<number[]> {
    return super.embedQuery(QUERY_INSTRUCTION + text);
  }
}

let embeddings: BgeEmbeddings | undefined;

export function getEmbeddings(): BgeEmbeddings {
  embeddings ??= new BgeEmbeddings({
    model: config.embeddingModel,
    pipelineOptions: { pooling: "cls", normalize: true },
  });
  return embeddings;
}
